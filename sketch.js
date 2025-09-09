let video;
let faceMesh;
let predictions = [];
let handPose;
let hands = [];

// Variable para controlar si la boca está abierta
let mouthOpen = false;

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1 }, modelReady);
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(640, 480);

  video = createCapture(VIDEO, { flipped: true }, () => {
    faceMesh.detectStart(video, gotFace);
    handPose.detectStart(video, gotHands);
  });

  video.size(width, height);
  video.hide();
}

function modelReady() {
  console.log("Modelos listos ✅");
}

function gotFace(results) {
  predictions = results;
}

function gotHands(results) {
  hands = results;
}

function draw() {
  image(video, 0, 0, width, height);

  // ========= CARA =========
  if (predictions.length > 0) {
    let keypoints = predictions[0].keypoints;

    // Puntos de referencia para la boca
    let topLip = keypoints[13];
    let bottomLip = keypoints[14];

    // Verificar apertura de la boca
    let mouthDist = dist(topLip.x, topLip.y, bottomLip.x, bottomLip.y);
    mouthOpen = mouthDist > 20;

    // Si la boca está abierta → cuadrado rojo
    if (mouthOpen) {
      fill(255, 0, 0, 200);
      noStroke();
      rectMode(CENTER);
      rect(width / 2, height - 100, 80, 80);
    }
  }

  // ========= MANOS =========
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i];
    for (let j = 0; j < hand.keypoints.length; j++) {
      let keypoint = hand.keypoints[j];
      fill(0, 255, 0);
      noStroke();
      circle(keypoint.x, keypoint.y, 10);
    }
  }
}
