const osc = require("osc");

let udpPort = new osc.UDPPort({
  localAddress: "127.0.0.1",
  localPort: 57121,
  remoteAddress: "127.0.0.1",
  remotePort: 7000 // Resolume escucha aquí
});

udpPort.open();

udpPort.on("ready", () => {
  console.log("OSC listo en 127.0.0.1:57121 → 127.0.0.1:7000");
});

function sendOSC(address, value) {
  let msg = {
    address: address,
    args: [{ type: "f", value: value }]
  };
  console.log("OSC →", address, value.toFixed(2));
  udpPort.send(msg);
}

// ---- ML5 + p5 ----
let faceMesh;
let handPose;
let video;
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: false };

let detections = { face: [], hand: [] };
let idCount = 0;
let timerMax = 8;

let valor = 100;
let easing = 0.2;
let targetValor = 100;

let fingerNames = ["index_finger", "middle_finger", "ring_finger", "pinky_finger"];
let fingerLabels = ["Índice", "Medio", "Anular", "Meñique"];

let fingerColorsLeft = ["#000000", "#000000", "#000000", "#000000"];
let fingerColorsRight = ["#000000", "#000000", "#000000", "#000000"];

let fingerMax = {
  "index_finger": 70,
  "middle_finger": 80,
  "ring_finger": 70,
  "pinky_finger": 60
};

let fingerValsLeft = [0, 0, 0, 0];
let fingerTargetsLeft = [0, 0, 0, 0];
let fingerValsRight = [0, 0, 0, 0];
let fingerTargetsRight = [0, 0, 0, 0];

function preload() {
  faceMesh = ml5.faceMesh(options);
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  faceMesh.detectStart(video, gotFaces);
  handPose.detectStart(video, gotHands);
}

function updateDetections(label, results) {
  let objects = detections[label];
  for (let obj of objects) obj.taken = false;

  for (let r of results) {
    let recordDist = Infinity;
    let closest = null;
    for (let candidate of objects) {
      if (!candidate.taken) {
        let d = dist(
          r.keypoints[0].x, r.keypoints[0].y,
          candidate.keypoints[0].x, candidate.keypoints[0].y
        );
        if (d < recordDist) {
          recordDist = d;
          closest = candidate;
        }
      }
    }
    if (closest) {
      for (let i = 0; i < r.keypoints.length; i++) {
        closest.keypoints[i].x = lerp(closest.keypoints[i].x, r.keypoints[i].x, 0.75);
        closest.keypoints[i].y = lerp(closest.keypoints[i].y, r.keypoints[i].y, 0.75);
      }
      closest.handedness = r.handedness || closest.handedness;
      closest.taken = true;
      closest.timer = timerMax;
    } else {
      r.id = idCount++;
      r.timer = timerMax;
      objects.push(r);
    }
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    objects[i].timer--;
    if (objects[i].timer <= 0) {
      objects.splice(i, 1);
    }
  }
}

function draw() {
  image(video, 0, 0, width, height);

  // === Boca ===
  for (let face of detections.face) {
    let topLip = face.keypoints[13];
    let bottomLip = face.keypoints[14];
    let mouthOpen = dist(topLip.x, topLip.y, bottomLip.x, bottomLip.y);

    if (mouthOpen > 10) {
      targetValor = map(mouthOpen, 10, 60, 0, 1, true);
      valor += (targetValor - valor) * easing;

      fill(0, 200, 0);
      rect(50, height - 80, valor * 300, 60);

      fill(255);
      textSize(16);
      text("Boca", 55, height - 85);

    }
  }

  // === Manos ===
  for (let hand of detections.hand) {
    let handLabel = hand.handedness;

    for (let f = 0; f < fingerNames.length; f++) {
      let finger = fingerNames[f];
      let points = hand.keypoints.filter(k => k.name.includes(finger));
      if (points.length >= 4) {
        let d = dist(points[0].x, points[0].y, points[3].x, points[3].y);
        let maxLen = fingerMax[finger];
        let target = map(d, 10, maxLen, 0, 1, true);

        if (handLabel === "Left") {
          fingerTargetsLeft[f] = target;
          fingerValsLeft[f] += (fingerTargetsLeft[f] - fingerValsLeft[f]) * easing;

          // OSC → mano izquierda controla links 5–8
          sendOSC(`/composition/dashboard/link${f + 5}`, fingerValsLeft[f]);
        } else if (handLabel === "Right") {
          fingerTargetsRight[f] = target;
          fingerValsRight[f] += (fingerTargetsRight[f] - fingerValsRight[f]) * easing;

          // OSC → mano derecha controla links 1–4
          sendOSC(`/composition/dashboard/link${f + 1}`, fingerValsRight[f]);
          
        }
      }
    }
  }

  // === Visualización ===
  for (let f = 0; f < fingerNames.length; f++) {
    fill(fingerColorsLeft[f]);
    rect(20, 50 + f * 70, fingerValsLeft[f] * 300, 40);
    fill(255);
    textSize(14);
    text(fingerLabels[f] + " (Izq)", 25, 45 + f * 70);
  }

  for (let f = 0; f < fingerNames.length; f++) {
    fill(fingerColorsRight[f]);
    rect(width - 20 - fingerValsRight[f] * 300, 50 + f * 70, fingerValsRight[f] * 300, 40);
    fill(255);
    textSize(14);
    text(fingerLabels[f] + " (Der)", width - 20 - fingerValsRight[f] * 300, 45 + f * 70);
  }
}

function gotFaces(results) {
  updateDetections("face", results);
}

function gotHands(results) {
  updateDetections("hand", results);
}
