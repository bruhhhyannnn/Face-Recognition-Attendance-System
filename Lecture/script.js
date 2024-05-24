var labels = [];
let detectedFaces = [];

document.getElementById("addButton").onclick = function() {
    document.getElementById("photoUpload").click();
};

document.getElementById("photoUpload").onchange = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const image = new Image();
            image.src = e.target.result;
            image.onload = function() {
                const canvas = document.getElementById('overlay');
                const ctx = canvas.getContext('2d');
                const videoAspectRatio = video.width / video.height;
                const imageAspectRatio = image.width / image.height;

                if (videoAspectRatio > imageAspectRatio) {
                    canvas.height = video.height;
                    canvas.width = image.width * (video.height / image.height);
                } else {
                    canvas.width = video.width;
                    canvas.height = image.height * (video.width / image.width);
                }
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

                recognizeFaces(image);
            };
        };
        reader.readAsDataURL(file);
    }
};

function recognizeFaces(image) {
    Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js/models'),
        faceapi.nets.ageGenderNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js/models')
    ]).then(async () => {
        const labeledFaceDescriptors = await getLabeledFaceDescriptions();
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

        const canvas = document.getElementById('overlay');
        const displaySize = { width: canvas.width, height: canvas.height };
        faceapi.matchDimensions(canvas, displaySize);

        const detections = await faceapi.detectAllFaces(image)
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

        detectedFaces = results.map(result => result.label);
        markAttendance(detectedFaces);

        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);
        });
    });
}



function updateTable() {
    var selectedCourseID = document.getElementById('courseSelect').value;
    var selectedUnitCode = document.getElementById('unitSelect').value;
    var selectedVenue = document.getElementById("venueSelect").value;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'manageFolder.php', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var response = JSON.parse(xhr.responseText);
            if (response.status === 'success') {
                labels = response.data;

                if (selectedCourseID && selectedUnitCode && selectedVenue) {
                  updateOtherElements();
                }             
         document.getElementById('studentTableContainer').innerHTML = response.html;
            } else {
                console.error('Error:', response.message);
            }
        }

    };
    xhr.send('courseID=' + encodeURIComponent(selectedCourseID) +
    '&unitID=' + encodeURIComponent(selectedUnitCode) +
    '&venueID=' + encodeURIComponent(selectedVenue))
    
    ;
    }



   

    


function updateOtherElements(){
   
const video = document.getElementById("video");
const videoContainer = document.querySelector(".video-container");
const startButton = document.getElementById("startButton");
let webcamStarted = false;
let modelsLoaded = false;


Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("http://localhost/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("http://localhost/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("http://localhost/models"),
]).then(() => {
  modelsLoaded = true;
});
startButton.addEventListener("click", async () => {
    videoContainer.style.display="flex";
  if (!webcamStarted && modelsLoaded) {
      startWebcam();
      webcamStarted = true;
  }
});




function startWebcam() {
  navigator.mediaDevices
      .getUserMedia({
          video: true,
          audio: false,
      })
      .then((stream) => {
          video.srcObject = stream;
          videoStream = stream; 
      })
      .catch((error) => {
          console.error(error);
      });

}
async function getLabeledFaceDescriptions() {
    const labeledDescriptors = [];

    for (const label of labels) {
        const descriptions = [];

        for (let i = 1; i <= 2; i++) {
            try {
                const img = await faceapi.fetchImage(`./labels/${label}/${i}.png`);
                const detections = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                
                if (detections) {
                    descriptions.push(detections.descriptor);
                } else {
                    console.log(`No face detected in ${label}/${i}.png`);
                }
            } catch (error) {
                console.error(`Error processing ${label}/${i}.png:`, error);
            }
        }

        if (descriptions.length > 0) {
            detectedFaces.push(label);
            labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptions));
        }
    }

    return labeledDescriptors;
}

let continuousDetection = {};

function markAttendance(detectedFaces) {
    document.querySelectorAll('#studentTableContainer tr').forEach(row => {
        const registrationNumber = row.cells[0].innerText.trim();
        if (detectedFaces.includes(registrationNumber)) {
            if (!continuousDetection[registrationNumber]) {
                continuousDetection[registrationNumber] = 1;
            } else {
                continuousDetection[registrationNumber]++;
            }

            if (continuousDetection[registrationNumber] >= 30) { // 30 frames ~ 3 seconds at 10 fps
                const attendanceCell = row.cells[5];
                if (attendanceCell.innerText.trim() !== 'Present') {
                    attendanceCell.innerText = 'Present';
                    attendanceCell.classList.add('highlight');
                    setTimeout(() => {
                        attendanceCell.classList.remove('highlight');
                    }, 2000);
                }
            }
        } else {
            continuousDetection[registrationNumber] = 0;
        }
    });
}

video.addEventListener("play", async () => {
    const labeledFaceDescriptors = await getLabeledFaceDescriptions();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

    const canvas = faceapi.createCanvasFromMedia(video);
    videoContainer.appendChild(canvas);

    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
        const detections = await faceapi
            .detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));

        detectedFaces = results.map(result => result.label);
        markAttendance(detectedFaces);

        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);
        });
    }, 100); // Adjust the interval to match the desired fps (100 ms interval is 10 fps)
});




function sendAttendanceDataToServer() {
    const attendanceData = [];

    document.querySelectorAll('#studentTableContainer tr').forEach((row, index) => {
        if (index === 0) return; 
        const studentID = row.cells[0].innerText.trim(); 
        const course = row.cells[2].innerText.trim();
        const unit = row.cells[3].innerText.trim();
        const attendanceStatus = row.cells[5].innerText.trim(); 

        attendanceData.push({ studentID,course,unit,attendanceStatus });
    });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'takeAttendance.php', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                showMessage('Attendance recorded successfully.');
            } else {
                showMessage('Error: Unable to record attendance.');
            }
        }
    };

    xhr.send(JSON.stringify(attendanceData));
}
function showMessage(message) {
    var messageDiv = document.getElementById('messageDiv');
    messageDiv.style.display="block";
    messageDiv.innerHTML = message;
    console.log(message);
    messageDiv.style.opacity = 1;
    setTimeout(function() {
      messageDiv.style.opacity = 0;
    }, 5000);
  }
function stopWebcam() {
    if (videoStream) {
        const tracks = videoStream.getTracks();

        tracks.forEach((track) => {
            track.stop();
        });

        video.srcObject = null;
        videoStream = null;
    }
}

document.getElementById("endAttendance").addEventListener("click", function() {
    sendAttendanceDataToServer();
    const videoContainer = document.querySelector(".video-container");
     videoContainer.style.display="none";
    stopWebcam();

});
}