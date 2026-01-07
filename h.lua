local vx = 0
local accel = 800        -- accel in px/s^2
local maxSpeed = 300
local damping = 6        -- per-second damping

-- initialize precise pos from current position
local x = motion_xposition():await()

forever(function(dt)
    local horiz = (keyDown("d") and 1 or 0) - (keyDown("a") and 1 or 0)
    -- integrate velocity (semi-implicit)
    vx = vx + horiz * accel * dt
    -- clamp
    if vx > maxSpeed then vx = maxSpeed end
    if vx < -maxSpeed then vx = -maxSpeed end
    -- integrate position using the (float) velocity
    x = x + vx * dt
    -- set precise position (avoids accumulating rounding artifacts)
    motion_setx(x)
    -- exponential damping (stable)
    vx = vx * math.exp(-damping * dt)
end)