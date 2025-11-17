// ======== CONFIG OSC ========
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

// ======== ML5 + p5 ========
let faceMesh;
let handPose;
let video;
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: true };

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
  createCanvas(530, 420, WEBGL);
  background(255);
    setAttributes('antialias', true);
  setAttributes('perPixelLighting', true);
  noStroke();

  video = createCapture(VIDEO);
  video.size(350, 250);
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
    if (objects[i].timer <= 0) objects.splice(i, 1);
  }
}

// ======== DIBUJO ========
function draw() {
  translate(-width/2, -height/2)
  background(255);

  // === DIBUJAR PUNTOS FACE ===
  noStroke();
  fill(0);
  for (let face of detections.face) {
    for (let k of face.keypoints) ellipse(k.x, k.y, 3, 3);
  }

  // === DIBUJAR PUNTOS MANOS ===
  for (let hand of detections.hand) {
    fill(0);
    for (let k of hand.keypoints) ellipse(k.x, k.y, 4, 4);
  }

  // === BOCA ===
  for (let face of detections.face) {
    let topLip = face.keypoints[13];
    let bottomLip = face.keypoints[14];
    let mouthOpen = dist(topLip.x, topLip.y, bottomLip.x, bottomLip.y);

    if (mouthOpen > 10) {
      targetValor = map(mouthOpen, 10, 60, 0, 1, true);
      valor += (targetValor - valor) * easing;


    }
  }


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
          sendOSC(`/composition/dashboard/link${f + 5}`, fingerValsLeft[f]);
        } else if (handLabel === "Right") {
          fingerTargetsRight[f] = target;
          fingerValsRight[f] += (fingerTargetsRight[f] - fingerValsRight[f]) * easing;
          sendOSC(`/composition/dashboard/link${f + 1}`, fingerValsRight[f]);
        }
      }
    }
  }


  drawKnobSet();
}


function drawKnob(x, y, value, col) {
  push();
  translate(x, y);
  noStroke();
  


  fill(230);
  ellipse(0, 0, 50, 50);


  let angle = map(value, 0, 1, -PI * 0.75, PI * 0.75);
  fill(col);
  arc(0, 0, 50, 50, -PI * 0.75, angle, PIE);

  stroke(0);
  strokeWeight(3);
  let r = 60;
  let ix = cos(angle) * r;
  let iy = sin(angle) * r;
  line(0, 0, ix, iy);

  pop();
}
// x, y, valorDedo, rango
function drawSphere(x, y, value, name) {
  //angulo  = map(valorDedo, rangoMin, rangoMax, 0, TWO_PI)
  const fMax = fingerMax[name]
  const angulo = map(value, 0, fMax, 0, 300)
  let colArray = [
    color(100),
    color(100),
    color(0),
  ];

 
  push()
  translate(x, y)

  for (let i = 0; i < colArray.length; i++) {
    let angle = angulo + ((TWO_PI / colArray.length) * i);
    let lightPosx = sin(angle);
    let lightPosy = cos(angle);
    directionalLight(colArray[i], lightPosx, lightPosy, lightPosx * lightPosy);
  }

  ambientLight(20);
  specularMaterial(255);
  sphere(25)
  pop()


}

function drawKnobSet() {
  textAlign(LEFT);
  textSize(12);

  for (let f = 0; f < fingerNames.length; f++) {

    const fName = fingerNames[f]

    drawSphere(60, 80 + f * 70,fingerValsLeft[f], fName)
   // drawKnob(60, 80 + f * 70, fingerValsLeft[f], color(fingerColorsLeft[f]));
    fill(0);
    text(fingerLabels[f] + " (Izq)", 35, 120 + f * 70);

    //drawKnob(width - 60, 80 + f * 70, fingerValsRight[f], color(fingerColorsRight[f]));
    drawSphere(width - 60, 80 + f * 70, fingerValsRight[f], fName)
    fill(0);
    textAlign(RIGHT);
    text(fingerLabels[f] + " (Der)", width - 35, 120 + f * 70);

    
  }
}


function gotFaces(results) {
  updateDetections("face", results);
}

function gotHands(results) {
  updateDetections("hand", results);
}
