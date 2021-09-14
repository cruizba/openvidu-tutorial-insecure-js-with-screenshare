// OpenVidu global variables
let OV;
let OVScreen
let session;
let sessionScreen

// User name and session name global variables
let myUserName;
let mySessionId;
let screensharing = false;


/* OPENVIDU METHODS */

function joinSession() {

	mySessionId = document.getElementById("sessionId").value;
	myUserName = document.getElementById("userName").value;

	// --- 1) Get an OpenVidu object ---
	OV = new OpenVidu();
	OVScreen = new OpenVidu();

	// --- 2) Init a session ---
	session = OV.initSession();
	sessionScreen = OVScreen.initSession();

	// --- 3) Specify the actions when events take place in the session ---

	// On every new Stream received from normal session...
	session.on('streamCreated', event => {
		let data = JSON.parse(event.stream.connection.data)
		let clientData = data.clientData;
		if (!clientData.endsWith("_SCREEN")) {
			// Subscribe to the Stream to receive it. HTML video will be appended to element with 'video-container' id
			let subscriber = session.subscribe(event.stream, 'video-container');
			// When the HTML video has been appended to DOM...
			subscriber.on('videoElementCreated', event => {
				// Add a new <p> element for the user's nickname just below its video
				appendUserData(event.element, subscriber.stream.connection);
			});
		}
	});

	// On every new Stream received from screen session...
	sessionScreen.on('streamCreated', event => {
		let data = JSON.parse(event.stream.connection.data)
		let clientData = data.clientData;
		if (clientData.endsWith("_SCREEN") && clientData != myUserName + "_SCREEN") {
			// Subscribe to the Stream to receive it. HTML video will be appended to element with 'container-screenshare' id
			let subscriberScreen = sessionScreen.subscribe(event.stream, 'container-screenshare');
			// When the HTML video has been appended to DOM...
			subscriberScreen.on('videoElementCreated', event => {
				// Add a new <p> element for the user's nickname just below its video
				appendUserData(event.element, subscriberScreen.stream.connection);
			});
		}
	});

	// On every Stream destroyed...
	session.on('streamDestroyed', event => {

		// Delete the HTML element with the user's nickname. HTML videos are automatically removed from DOM
		removeUserData(event.stream.connection);
	});

	// On every asynchronous exception...
	session.on('exception', (exception) => {
		console.warn(exception);
	});


	// --- 4) Connect to the session with a valid user token ---

	// 'getToken' method is simulating what your server-side should do.
	// 'token' parameter should be retrieved and returned by your own backend
	getToken(mySessionId).then(token => {

		// First param is the token got from OpenVidu Server. Second param can be retrieved by every user on event
		// 'streamCreated' (property Stream.connection.data), and will be appended to DOM as the user's nickname
		session.connect(token, { clientData: myUserName })
			.then(() => {

				// --- 5) Set page layout for active call ---

				document.getElementById('session-title').innerText = mySessionId;
				document.getElementById('join').style.display = 'none';
				document.getElementById('session').style.display = 'block';
				document.getElementById('screenshare').style.display = 'block';

				// --- 6) Get your own camera stream with the desired properties ---

				let publisher = OV.initPublisher('video-container', {
					audioSource: undefined, // The source of audio. If undefined default microphone
					videoSource: undefined, // The source of video. If undefined default webcam
					publishAudio: true,  	// Whether you want to start publishing with your audio unmuted or not
					publishVideo: true,  	// Whether you want to start publishing with your video enabled or not
					resolution: '640x480',  // The resolution of your video
					frameRate: 30,			// The frame rate of your video
					insertMode: 'APPEND',	// How the video is inserted in the target element 'video-container'
					mirror: false       	// Whether to mirror your local video or not
				});

				// --- 7) Specify the actions when events take place in our publisher ---

				// When our HTML video has been added to DOM...
				publisher.on('videoElementCreated', function (event) {
					initMainVideo(event.element, myUserName);
					appendUserData(event.element, myUserName);
					event.element['muted'] = true;
				});

				// --- 8) Publish your stream ---

				session.publish(publisher);

				// Connect screenshare session
				getToken(mySessionId).then((tokenScreen) => {
					// Create a token for screenshare
					sessionScreen.connect(tokenScreen, { clientData: myUserName + "_SCREEN" }).then(() => {
						document.getElementById('buttonScreenShare').style.visibility = 'visible';
						console.log("Session screen connected");
					}).catch((error => {
						console.warn('There was an error connecting to the session for screenshare:', error.code, error.message);
					}));;
				})

			})
			.catch(error => {
				console.log('There was an error connecting to the session:', error.code, error.message);
			});
	});
}

function leaveSession() {

	// --- 9) Leave the session by calling 'disconnect' method over the Session object ---

	session.disconnect();
	if (sessionScreen) {
		sessionScreen.disconnect();
	}

	// Removing all HTML elements with user's nicknames.
	// HTML videos are automatically removed when leaving a Session
	removeAllUserData();
	clearScreenShare();

	// Back to 'Join session' page
	document.getElementById('join').style.display = 'block';
	document.getElementById('session').style.display = 'none';
	document.getElementById('screenshare').style.display = 'none';
	screensharing = false;
}



/* APPLICATION SPECIFIC METHODS */

window.addEventListener('load', function () {
	generateParticipantInfo();
});

window.onbeforeunload = function () {
	if (session) session.disconnect();
};

function generateParticipantInfo() {
	document.getElementById("sessionId").value = "SessionA";
	document.getElementById("userName").value = "Participant" + Math.floor(Math.random() * 100);
}

function appendUserData(videoElement, connection) {
	let userData;
	let nodeId;
	if (typeof connection === "string") {
		userData = connection;
		nodeId = connection;
	} else {
		userData = JSON.parse(connection.data).clientData;
		nodeId = connection.connectionId;
	}
	let dataNode = document.createElement('div');
	dataNode.className = "data-node";
	dataNode.id = "data-" + nodeId;
	dataNode.innerHTML = "<p>" + userData + "</p>";
	videoElement.parentNode.insertBefore(dataNode, videoElement.nextSibling);
	addClickListener(videoElement, userData);
}

function removeUserData(connection) {
	let dataNode = document.getElementById("data-" + connection.connectionId);
	if (dataNode) {
		dataNode.parentNode.removeChild(dataNode);
	}
}

function removeScreenShareLocalData(clienData) {
	console.log("Removing Screen Share..." + clienData)
	let dataNode = document.getElementById("data-" + clienData);
	videoElement = document.getElementById("data-" + clienData).previousSibling;
	parentNode = dataNode.parentNode;
	parentNode.removeChild(videoElement);
	parentNode.removeChild(dataNode);
}

function removeAllUserData() {
	let nicknameElements = document.getElementsByClassName('data-node');
	while (nicknameElements[0]) {
		nicknameElements[0].parentNode.removeChild(nicknameElements[0]);
	}
}

function addClickListener(videoElement, userData) {
	videoElement.addEventListener('click', function () {
		let mainVideo = $('#main-video video').get(0);
		if (mainVideo.srcObject !== videoElement.srcObject) {
			$('#main-video').fadeOut("fast", () => {
				$('#main-video p').html(userData);
				mainVideo.srcObject = videoElement.srcObject;
				$('#main-video').fadeIn("fast");
			});
		}
	});
}

function initMainVideo(videoElement, userData) {
	document.querySelector('#main-video video').srcObject = videoElement.srcObject;
	document.querySelector('#main-video p').innerHTML = userData;
	document.querySelector('#main-video video')['muted'] = true;
}

function publishScreenShare() {
	let publisher = OVScreen.initPublisher("container-screenshare", { videoSource: "screen" });
	publisher.once('accessAllowed', (event) => {
		document.getElementById('buttonScreenShare').style.visibility = 'hidden';
		screensharing = true;
		publisher.stream.getMediaStream().getVideoTracks()[0].addEventListener('ended', () => {
			console.log('User pressed the "Stop sharing" button');
			sessionScreen.unpublish(sessionScreen.connection);
			removeScreenShareLocalData(myUserName + "_SCREEN");
			document.getElementById('buttonScreenShare').style.visibility = 'visible';
			screensharing = false;
		});
		sessionScreen.publish(publisher);

	});

	publisher.on('videoElementCreated', function (event) {
		appendUserData(event.element, myUserName + "_SCREEN");
		event.element['muted'] = true;
	});

	publisher.once('accessDenied', (event) => {
		console.warn('ScreenShare: Access Denied');
	});
	console.log("Screen share");
}


/**
 * --------------------------
 * SERVER-SIDE RESPONSIBILITY
 * --------------------------
 * These methods retrieve the mandatory user token from OpenVidu Server.
 * This behavior MUST BE IN YOUR SERVER-SIDE IN PRODUCTION (by using
 * the API REST, openvidu-java-client or openvidu-node-client):
 *   1) Initialize a Session in OpenVidu Server	(POST /openvidu/api/sessions)
 *   2) Create a Connection in OpenVidu Server (POST /openvidu/api/sessions/<SESSION_ID>/connection)
 *   3) The Connection.token must be consumed in Session.connect() method
 */

let OPENVIDU_SERVER_URL = "https://" + location.hostname + ":4443";
let OPENVIDU_SERVER_SECRET = "MY_SECRET";

function getToken(mySessionId) {
	return createSession(mySessionId).then(sessionId => createToken(sessionId));
}

function createSession(sessionId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-openviduapisessions
	return new Promise((resolve, reject) => {
		$.ajax({
			type: "POST",
			url: OPENVIDU_SERVER_URL + "/openvidu/api/sessions",
			data: JSON.stringify({ customSessionId: sessionId }),
			headers: {
				"Authorization": "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
				"Content-Type": "application/json"
			},
			success: response => resolve(response.id),
			error: (error) => {
				if (error.status === 409) {
					resolve(sessionId);
				} else {
					console.warn('No connection to OpenVidu Server. This may be a certificate error at ' + OPENVIDU_SERVER_URL);
					if (window.confirm('No connection to OpenVidu Server. This may be a certificate error at \"' + OPENVIDU_SERVER_URL + '\"\n\nClick OK to navigate and accept it. ' +
						'If no certificate warning is shown, then check that your OpenVidu Server is up and running at "' + OPENVIDU_SERVER_URL + '"')) {
						location.assign(OPENVIDU_SERVER_URL + '/accept-certificate');
					}
				}
			}
		});
	});
}

function createToken(sessionId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-openviduapisessionsltsession_idgtconnection
    return new Promise((resolve, reject) => {
        $.ajax({
            type: 'POST',
            url: OPENVIDU_SERVER_URL + '/openvidu/api/sessions/' + sessionId + '/connection',
            data: JSON.stringify({}),
            headers: {
                'Authorization': 'Basic ' + btoa('OPENVIDUAPP:' + OPENVIDU_SERVER_SECRET),
                'Content-Type': 'application/json',
            },
            success: (response) => resolve(response.token),
            error: (error) => reject(error)
        });
    });
}
