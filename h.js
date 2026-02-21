let vx = 0;
const accel = 800; // accel in px/s^2
const maxSpeed = 300;
const damping = 6; // per-second damping
// initialize precise pos from current position (motion_xposition may be async)
let x = await motion_xposition();

forever((dt) => {
  try {
    const horiz = Number(keyDown("d")) - Number(keyDown("a"));
    // integrate velocity
    vx += horiz * accel * dt;
    // clamp
    if (vx > maxSpeed) vx = maxSpeed;
    if (vx < -maxSpeed) vx = -maxSpeed;
    // integrate position using the (float) velocity
    x += vx * dt;
    // set precise position (avoids accumulating rounding artifacts)
    motion_setx(x);
    // exponential damping (stable)
    vx = vx * Math.exp(-damping * dt);
  } catch (e) {
    console.error("[h.js] forever handler error:", e);
  }
});
