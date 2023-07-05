// Kevs

console.log = (foo) => {
    Trace(foo);
}

let firstNote = true;

function HandleMIDI(e) {
    // API

    /*
    KEV: event object data...
detune0
pitch79
velocity93
status144
isRealtimetrue
data179
data30
data293
channel1
port1
articulationID0
beatPos0
toStringfunction () {
	var returnString = '[' + this.className() +
	' channel:' + this.channel +
	' pitch:' + this.pitch +
  ' [' + MIDI.noteName(this.pitch) + ']' +
	' velocity:' + this.velocity;
	if (this.articulationID > 0)
		returnString += ' articulationID:' + this.articulationID;
  if (this.port > 1)
    returnString += ' port:' + this.port;
	returnString += ']';
	return returnString;
}
sendAfterBeatsfunction sendAfterBeats() {
    [native code]
}
tracefunction trace() {
    [native code]
}
sendAtBeatfunction sendAtBeat() {
    [native code]
}
sendAfterMillisecondsfunction sendAfterMilliseconds() {
    [native code]
}
sendfunction send() {
    [native code]
}
classNamefunction () {
  return Object.prototype.toString.call(this).slice(8,-1);
}
KEV144	79	93
KEV: event object data...
pitch79
velocity64
status128
isRealtimetrue
data179
data30
data264
channel1
port1
articulationID0
beatPos0
toStringfunction () {
	var returnString = '[' + this.className() +
	' channel:' + this.channel +
	' pitch:' + this.pitch +
  ' [' + MIDI.noteName(this.pitch) + ']' +
	' velocity:' + this.velocity;
	if (this.articulationID > 0)
		returnString += ' articulationID:' + this.articulationID;
  if (this.port > 1)
    returnString += ' port:' + this.port;
	returnString += ']';
	return returnString;
}
sendAfterBeatsfunction sendAfterBeats() {
    [native code]
}
tracefunction trace() {
    [native code]
}
sendAtBeatfunction sendAtBeat() {
    [native code]
}
sendAfterMillisecondsfunction sendAfterMilliseconds() {
    [native code]
}
sendfunction send() {
    [native code]
}
classNamefunction () {
  return Object.prototype.toString.call(this).slice(8,-1);
}

     */
    if (firstNote) {
        console.log("KEV: event object data...")
        firstNote = false;
        for (let i in e) {
            console.log(i + "" + e[i])
        }
    }

    // pass through
    e.send();

    // Event Objects
    if (displayMode == 0) {
        console.log("KEV event: " + e);
    }
    // MIDI Bytes
    else if (displayMode == 1) {
        console.log("KEV" + (e.status + e.channel-1) +
            '\t' + e.data1 +
            '\t' + e.data2);
    }
    // Hex
    else if (displayMode == 2) {
        var hex = function(num) { return num.toString(16) };
        console.log('0x' + hex((e.status + e.channel-1)) +
            '  0x' + hex(e.data1) +
            '\t0x' + hex(e.data2));
    }
}

//-----------------------------------------------------------------------------
var PluginParameters =
    [
        {name:"Display Mode",
            type:"menu", valueStrings:["Event Objects",
                "MIDI Bytes",
                "Hex"],
            numberOfSteps: 3, defaultValue: 0}
    ];

var displayMode = 0;

function ParameterChanged(param, value) {
    displayMode = value;
}