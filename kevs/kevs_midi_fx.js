// Kevs Logic Pro Debug API discovery thingy

console.log = (foo) => {
    Trace(foo);
}

let firstNote = true;

function HandleMIDI(e) {
    // API

/*
KEV: event object data...
pitch=74
velocity=64
status=128
isRealtime=true
data1=74
data3=0
data2=64
channel=1
port=1
articulationID=0
beatPos=0
toString=function () {
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
sendAfterBeats=function sendAfterBeats()
trace=function trace()
sendAtBeat=function sendAtBeat()
sendAfterMilliseconds=function sendAfterMilliseconds()
send=function send()
className=function () {
  return Object.prototype.toString.call(this).slice(8,-1);
}

     */
    if (1 || firstNote) {
        console.log("KEV: event object data...")
        firstNote = false;
        for (let i in e) {
            console.log(i + "=" + e[i])
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