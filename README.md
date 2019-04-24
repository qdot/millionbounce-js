# MillionBounce - Master-A-Million Node.js/WebBluetooth Drivers

Javascript/Typescript project for exposing access to Bluetooth
functionality of the [Master A Million 2.0]() Bluetooth Bouncy Ball.

## Installation

```
npm install
```

## Notes

- The first time you register a ball, you'll need to set the ID. If
  it's just blinking red for a couple of minutes, that means it's
  uninitialized and needs an ID. If the ID isn't set within ~2
  minutes, bluetooth shuts down. An ID is just a 24 bit number,
  usually provisioned by the MAM website, but you can just put
  anything in. Note that if you use a number then try to use the app,
  I have no idea what will happen.
- After an ID is set, the ball will blink red 3 times every time you
  bounce it. This will start bluetooth up for something like 20
  seconds. AFAICT there is no keep alive outside of bouncing the ball
  more, which resets the timer. After that, the ball just shuts down
  until bounced again. That makes this less than useful for
  WebBluetooth, which requires user gesture reconnects every time the
  device disconnects. I'm not sure if there's a protocol based
  keepalive yet.

## Donate!

If you'd like to see more stupid projects like this, feel free to
[donate to my patreon](https://patreon.com/qdot)

## Why isn't it just named masteramillion?

That's a trademarked term, and naming packages like that can get a
little dicey sometimes. In lieu of having to change the name later, I
just made it something vaguely close for now.
