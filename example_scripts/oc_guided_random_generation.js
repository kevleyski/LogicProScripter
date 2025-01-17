/******************************************************************************
Name: Guided Random Generation
Author(s): Philip Regan

Roadmap:
* Need a better way to handle assignments which are turned off

Purpose: 
* Uses a Markov Chain to better guide random music generation.
    * While the weighted random music generation would select a note based upon 
    the weights at a particular point in time, the Markov Chain will make a 
    selection based on the previous selection, weighted or otherwise.
    * For example, the following chord progression with variations can be made 
    into a Markov Chain:
 
    I → vi → {IV, ii} → {V, vii˚} → iii → I

    In the above example, the progression would be determined at each iteration 
        * Starts with the I
        * Moves to the vi because the I preceeded it.
        * Selects either IV or ii randomly because the vi was the last one 
        selected
        * Selects either V or vii˚ randomluy because either IV or ii was 
        selected
        * Moves to the iii because other V or vii˚ was the last one selected
        * Moves back to the I because was selected last.
    * At each iteration, if there is more than one value to be selected, then 
    those values can also be weighted (weight the V greater than the vii˚).

    To encode this for Scripter, the following Object (JSON) could be used:
    var CHAIN = {
        I   :   [ vi ],
        ii  :   [ V, vii˚ ],
        iii :   [ I ],
        IV  :   [ V, vii˚ ],
        V   :   [ iii ],
        vi  :   [ IV, ii ],
        vii˚:   [ iii ]
    }

    To take this a step further, weighted random selection can be used to add
    nuance to the progression. Using the format in the oc_weighted_random_selection 
    script

    var CHAIN = {
        I   :   { 100:vi },
        ii  :   { 60:V, 40:vii˚ },
        iii :   { 100:I },
        IV  :   { 80:V, 20:vii˚ },
        V   :   { 100:iii },
        vi  :   { 60:IV, 40:ii },
        vii˚:   { 100:iii }
    }

    A couple things to note:
    * Even though { ii, IV } is followed by { V, vii˚ } in the first version, 
    different weights can be added to each of the subsequent chord selections 
    to provide more direction to the progression, like ensuring there is better 
    voice leading between the chords.
    * In this example, if the intended starter value is the I, then the first
    key to be used needs to be iii.
    * In this script, the chain is used to create single notes, but the values
    in the chain can represent and be applied to any event, parameter, or 
    behavior.

* Markov Chain: a sequence of possible events in which the probability of each 
event depends only on the state attained in the previous event. See
https://en.wikipedia.org/wiki/Markov_chain

This script is released under the MIT License.

Permissions
* Commercial use
* Modification
* Distribution
* Private use

Limitations
x Liability
x Warranty

Conditions
! License and copyright notice

Copyright Philip Regan and Pilcrow Records

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

****************************************************************************/

var PluginParameters = [];
var NeedsTimingInfo = true;

const TARGET_OCTAVE_LIB = {
    "8"             :   10, 
    "7"             :   9, 
    "6"             :   8, 
    "5"             :   7, 
    "4"             :   6, 
    "3 (Middle C)"  :   5, 
    "2"             :   4, 
    "1"             :   3, 
    "0"             :   2, 
    "-1"            :   1, 
    "-2"            :   0
};

const TARGET_OCTAVE_KEYS = ["8", "7", "6", "5", "4", "3 (Middle C)", "2", "1", "0", "-1", "-2"];
var TARGET_OCTAVE = TARGET_OCTAVE_LIB["3 (Middle C)"];

const NOTE_LENGTHS_LIB = {
	"1/128"		:	0.0105,
    "1/128d"	:	0.04725,
    "1/128t"	:	0.0416,
    "1/64"      :   0.063,
    "1/64d"     :   0.094,
    "1/64t"     :   0.021,
    "1/32"	    :	0.125,
    "1/32d"	    :	0.188,
    "1/32t"	    :	0.041,
    "1/16"	    :	0.250,
    "1/16d"	    :	0.375,
    "1/16t"	    :	0.333,
    "1/8" 	    :	0.500,
    "1/8d"	    :	0.750,
    "1/8t"	    :	0.1667,
    "1/4" 	    :	1.000,
    "1/4d"	    :	1.500,
    "1/4t"	    :	0.300,
    "1/2" 	    :	2.000,
    "1/2d"	    :	3.000,
    "1/2t"	    :	1.667,
    "1 bar"		:	4.000,
    "2 bars"		:	8.000,
    "4 bars"		:	16.000
};
var NOTE_LENGTH_KEYS = Object.keys( NOTE_LENGTHS_LIB );

// var whole_note = NOTE_LENGTH_KEYS.shift();
// var whole_triplet = NOTE_LENGTH_KEYS.pop();
// NOTE_LENGTH_KEYS.push( whole_note );
// NOTE_LENGTH_KEYS.push( whole_triplet );

/* 
    Markov Chain
*/

var EXAMPLE_CHAINS = {
    "BASIC_EXAMPLE" : {
        "I"   :   { 
            "50":"I",
            "100":"VI", 
            "total":100 
        },
        "II"  :   { 
            "20":"II",
            "60":"V", 
            "100":"VII", 
            "total":100 
        },
        "III" :   { 
            "20":"III",
            "100":"I", 
            "total":100 
        },
        "IV"  :   { 
            "20":"IV",
            "80":"V", 
            "100":"VII", 
            "total":100 
        },
        "V"   :   { 
            "20":"V",
            "100":"III", 
            "total":100 
        },
        "VI"  :   { 
            "20":"VI",
            "60":"IV", 
            "100":"II", 
            "total":100 
        },
        "VII":   { 
            "20":"VII",
            "100":"III", 
            "total":100 
        },
        "START" : "I"
    },
    "THIRDS" : {
        "I"   :   { 
            "20":"I",
            "50":"III",
            "100":"VI", 
            "total":100 
        },
        "II"  :   { 
            "20":"II",
            "50":"IV", 
            "100":"VII", 
            "total":100 
        },
        "III" :   { 
            "20":"III",
            "50":"I",
            "100":"V", 
            "total":100 
        },
        "IV"  :   { 
            "20":"IV",
            "50":"II", 
            "100":"VI", 
            "total":100 
        },
        "V"   :   { 
            "20":"V",
            "50":"III", 
            "100":"VII",
            "total":100 
        },
        "VI"  :   { 
            "20":"VI",
            "50":"IV", 
            "100":"II", 
            "total":100 
        },
        "VII":   { 
            "20":"VII",
            "50":"II",
            "100":"V", 
            "total":100 
        },
        "START" : "I"
    },
    "PENTA1 (I->II, III, V, VI)" : {
        "I"   :   { 
            "10":"I",
            "25":"II",
            "50":"III",
            "75":"V",
            "100":"VI", 
            "total":100 
        },
        "II"   :   {
            "10":"II", 
            "25":"III",
            "50":"IV",
            "75":"VI",
            "100":"VII", 
            "total":100 
        },
        "III"   :   { 
            "10":"III",
            "25":"IV",
            "50":"V",
            "75":"VII",
            "100":"I", 
            "total":100 
        },
        "IV"   :   { 
            "10":"IV",
            "25":"V",
            "50":"VI",
            "75":"I",
            "100":"II", 
            "total":100 
        },
        "V"   :   { 
            "10":"V",
            "25":"VI",
            "50":"VII",
            "75":"II",
            "100":"III", 
            "total":100 
        },
        "VI"   :   { 
            "10":"VI",
            "25":"VII",
            "50":"I",
            "75":"III",
            "100":"IV", 
            "total":100 
        },
        "VII"   :   { 
            "10":"VII",
            "25":"I",
            "50":"II",
            "75":"IV",
            "100":"V", 
            "total":100 
        },
        "START" : "I"
    },
    "PENTA2 (I, II, III, V, VI)" : {
        "I"   :   { 
            "10":"I",
            "25":"II",
            "50":"III",
            "75":"V",
            "100":"VI", 
            "total":100 
        },
        "II"   :   { 
            "10":"II",
            "25":"I",
            "50":"III",
            "75":"V",
            "100":"VI", 
            "total":100 
        },
        "III"   :   { 
            "10":"III",
            "25":"I",
            "50":"II",
            "75":"V",
            "100":"VI", 
            "total":100 
        },
        "V"   :   { 
            "10":"V",
            "25":"I",
            "50":"II",
            "75":"III",
            "100":"VI", 
            "total":100 
        },
        "VI"   :   { 
            "10":"VI",
            "25":"I",
            "50":"II",
            "75":"III",
            "100":"V", 
            "total":100 
        },
        "START" : "I"
    },
    "MAJOR MAPPING" : {
        "I" : {
            "11" : 	"I",
            "55" : 	"II",
            "66" : 	"IV",
            "100" : 	"V",
        "total" : 100
        },
            "II" : {
            "22" : 	"I",
            "44" : 	"II",
            "66" : 	"III",
            "77" : 	"IV",
            "100" : 	"V",
        "total" : 100
        },
        "III" :{
            "20" : 	"III",
            "60" : 	"IV",
            "100" : "VI",
        "total" : 100
        },
        "IV" : {
            "54" : 	"I",
            "63" : 	"II",
            "72" : 	"IV",
            "90" : 	"V",
            "100" : 	"VII",
            "total" : 100
        },
        "V" : {
            "36" : 	"I",
            "48" : 	"II",
            "60" : 	"III",
            "72" : 	"V",
            "100" : "VI",
            "total" : 100
        },
        "VI" : {
            "16" : 	"I",
            "64" : 	"II",
            "80" : 	"IV",
            "100" : 	"VII",
            "total" : 100
        },
        "VII" : {
            "40" : 	"I",
            "80" : 	"III",
            "100" : "VII",
            "total" : 100
        },
        "START" : "I"
    }, 
    "MINOR MAPPING" : {
        "I" : {
            "18" : 	"I",
            "45" : 	"II",
            "72" : 	"IV",
            "90" : 	"V",
            "100" : "VII",
            "total" : 100
        },
        "II" : {
    
            "30" : 	"I",
            "42" : 	"II",
            "54" : 	"III",
            "66" : 	"IV",
            "84" : 	"V",
            "90" : 	"VI",
            "100" : 	"VII",
            "total" : 100
        },
        "III" : {
            "12" : 	"I",
            "36" : 	"II",
            "48" : 	"III",
            "84" : 	"IV",
            "100" : "VI",
            "total" : 100
        },
        "IV" : {
            "40" : 	"I",
            "56" : 	"II",
            "72" : 	"IV",
            "88" : 	"V",
            "100" : 	"VII",
            "total" : 100
        },
        "V" : { 
            "40" : 	"I",
            "56" : 	"III",
            "72" : 	"IV",
            "80" : 	"V",
            "100" : 	"VI",
            "total" : 100
        },
        "VI" : {
            "16" : 	"I",
            "48" : 	"II",
            "64" : 	"IV",
            "80" : 	"VI",
            "100" : 	"VII",
            "total" : 100
        },
        "VII" : {
            "30" : 	"I",
            "50" : 	"III",
            "70" : 	"IV",
            "80" : 	"V",
            "90" : 	"VI",
            "100" : "VII",
            "total" : 100
        },
        "START" : "I"
    },
    "MAJOR PENTA" : {
        "I" : {
            "11" : 	"I",
            "55" : 	"II",
            "100" : 	"V",
        "total" : 100
        },
            "II" : {
            "44" : 	"II",
            "66" : 	"III",
            "100" : 	"IV",
        "total" : 100
        },
        "III" :{
            "20" : 	"III",
            "100" : 	"IV",
        "total" : 100
        },
        "IV" : {
            "54" : 	"I",
            "72" : 	"IV",
            "100" : 	"V",
            "total" : 100
        },
        "V" : {
            "48" : 	"II",
            "60" : 	"III",
            "72" : 	"V",
            "100" : "VI",
            "total" : 100
        },
        "VI" : {
            "16" : 	"I",
            "80" : 	"IV",
            "100" : 	"VII",
            "total" : 100
        },
        "VII" : {
            "40" : 	"I",
            "100" : "VII",
            "total" : 100
        },
        "START" : "I"
    }, 
    "MINOR PENTA" : {
        "I" : {
            "18" : 	"I",
            "45" : 	"II",
            "100" : 	"V",
            "total" : 100
        },
        "II" : {
            "42" : 	"II",
            "54" : 	"III",
            "66" : 	"IV",
            "90" : 	"VI",
            "100" : 	"VII",
            "total" : 100
        },
        "III" : {
            "12" : 	"I",
            "48" : 	"III",
            "100" : 	"IV",
            "total" : 100
        },
        "IV" : {
            "40" : 	"I",
            "56" : 	"II",
            "72" : 	"IV",
            "100" : 	"V",
            "total" : 100
        },
        "V" : { 
            "56" : 	"III",
            "80" : 	"V",
            "100" : 	"VI",
            "total" : 100
        },
        "VI" : {
            "16" : 	"I",
            "64" : 	"IV",
            "80" : 	"VI",
            "100" : 	"VII",
            "total" : 100
        },
        "VII" : {
            "30" : 	"I",
            "70" : 	"IV",
            "80" : 	"V",
            "100" : "VII",
            "total" : 100
        },
        "START" : "I"
    }
}

var CHAIN = EXAMPLE_CHAINS["VOICE_LEADING_3"];

// pitch CHAIN_ASSIGNMENTS are handled as -2 octave pitch values
var CHAIN_ASSIGNMENTS = {
    "I"   :   0,
    "II"  :   2,
    "III" :   4,
    "IV"  :   5,
    "V"   :   7,
    "VI"  :   9,
    "VII":   11
}

var CHAIN_LAST_SELECTION = "";
var CHAIN_STARTED = false;

function HandleMIDI( event ) {
    event.send();
}

// the trigger variable is where the next note (or rest) is to be played
// trigger is global to track it across process blocks
// the cursor is a simulated location of the transport/playhead in the track
// cursor is handled locally because only the current process block matters while playing
const RESET_VALUE = -1.0;
var TRIGGER = RESET_VALUE;
const CURSOR_INCREMENT = 0.001; // smallest note length = 0.125

var ACTIVE_RGEN_NOTES = [];

function ProcessMIDI() {
	var timing_info = GetTimingInfo();

	// when the transport stops, stop any playing notes and track the cursor and trigger so play can begin uninterrupted
	if ( !timing_info.playing ){
		ACTIVE_RGEN_NOTES.forEach( function ( note_on ) {
			var note_off = new NoteOff( note_on );
			note_off.send();
		});
		cursor = timing_info.blockStartBeat;
		TRIGGER = RESET_VALUE;
        CHAIN_STARTED = false;
		return;
	}
	
	// calculate beat to schedule
	var lookAheadEnd = timing_info.blockEndBeat;
	var cursor = timing_info.blockStartBeat;
	if ( TRIGGER == RESET_VALUE ) {
		TRIGGER = timing_info.blockStartBeat;
	}

	// trigger can get stuck outside of cycle causing whole cycle loss of music
	if ( timing_info.cycling && ( !TRIGGER || TRIGGER > timing_info.rightCycleBeat ) ) {
		TRIGGER = ( timing_info.rightCycleBeat > timing_info.blockEndBeat ? timing_info.rightCycleBeat : timing_info.blockEndBeat ); 
		// Assumes the cycle is on a whole number (quarter beat/bottom denominator in time sig);
		if ( TRIGGER == timing_info.rightCycleBeat && Math.trunc(cursor) == timing_info.leftCycleBeat ) {
			TRIGGER = timing_info.blockStartBeat;
		}
			
	}

    // cycling the playhead cretes buffers which need to be managed
    // the buffers are the edges of the cycle
    // process blocks do not line up with cycle bounds
	// when cycling, find the beats that wrap around the last buffer
	if ( timing_info.cycling && lookAheadEnd >= timing_info.rightCycleBeat ) {
        // is the end of the process block past the end of the cycle?
		if ( lookAheadEnd >= timing_info.rightCycleBeat ) {
            // get the length of the process block
			var cycleBeats = timing_info.rightCycleBeat - timing_info.leftCycleBeat;
            // get the difference between the end of the process block and the cycle length
            // this will be the relative shift back to the beginning of the cycle
			var cycleEnd = lookAheadEnd - cycleBeats;
		}
	}

	// increment the cursor through the beats that fall within this cycle's buffers
	while ((cursor >= timing_info.blockStartBeat && cursor < lookAheadEnd)
	// including beats that wrap around the cycle point
	|| (timing_info.cycling && cursor < cycleEnd)) {
		// adjust the cursor and the trigger for the cycle
		if (timing_info.cycling && cursor >= timing_info.rightCycleBeat) {
			cursor -= (timing_info.rightCycleBeat - timing_info.leftCycleBeat);
			TRIGGER = cursor;
		}
        
        // the cursor has come to the trigger
		if ( cursor == TRIGGER ) {

            //  select a pitch from the selected markov chain
            let iteration_key = "";
            let pool = {};
            let iteration_selection = "";

            if ( !CHAIN_STARTED ) {
                iteration_key = CHAIN["START"];
                pool = CHAIN[ iteration_key ];
                // select a pitch from the pool
                iteration_selection = getRandomValueFromWeightPool( pool );
                CHAIN_LAST_SELECTION = iteration_selection;
                CHAIN_STARTED = true;
            } else {
                iteration_key = CHAIN_LAST_SELECTION;
                pool = CHAIN[ iteration_key ];
                if ( !pool ) {
                    iteration_key = CHAIN["START"];
                    pool = CHAIN[ iteration_key ];
                }
                iteration_selection = getRandomValueFromWeightPool( pool );
                CHAIN_LAST_SELECTION = iteration_selection;
            }

            // init the note event parameters: pitch and length
            let pitch = CHAIN_ASSIGNMENTS[ iteration_selection ];
            Trace("iteration_selection: " + iteration_selection);
            pitch += TARGET_OCTAVE * 12;
            let iteration_index = GetParameter( "Iteration Length" );
            let event_length = NOTE_LENGTHS_LIB[ NOTE_LENGTH_KEYS[ iteration_index ] ];

            var note_on = new NoteOn();
            note_on.pitch = pitch;
            note_on.velocity = 100;

            note_on.sendAtBeat( TRIGGER ); 
            ACTIVE_RGEN_NOTES.push( note_on );

            var note_off = new NoteOff( note_on );
            var note_off_beat = TRIGGER + event_length;

            // adjust for the cycle buffers
            if ( timing_info.cycling && note_off_beat >= timing_info.rightCycleBeat ) {
                while ( note_off_beat >= timing_info.rightCycleBeat ) {
                    note_off_beat -= cycleBeats;
                    // ERROR: note_off_beat = null
                    // ATTEMPT: chaning cycleBeats to actual calc crams events at the end of the cycle
                }
            }

            note_off.sendAtBeat( note_off_beat );

            TRIGGER = note_off_beat;

		}

		// advance the cursor and trigger to the next beat
		cursor += CURSOR_INCREMENT;
		if ( TRIGGER < cursor ) {
			TRIGGER = cursor;
		}
	}
	
}

function getRandomValueFromWeightPool( weightPool ) {

    Trace("getRandomValueFromWeightPool: " + JSON.stringify(weightPool));

	var total = weightPool["total"];

	var r = rInt( 1, total );
	var weights = Object.keys(weightPool);

	if ( weights.length == 2 ) {
		return weightPool[weights[0]];
	}

	weights.pop();
	var last_weight = total;
	for ( let index = weights.length - 1 ; index > -1 ; index-- ) {
		const weight = parseInt(weights[index]);
		if ( r > weight ) {
			return weightPool[last_weight];
		}
	    last_weight = weight;
	}

    let result = weightPool[weights[0]];

    if ( result == undefined ) {
        Trace("ERROR: getRandomValueFromWeightPool " + JSON.stringify( weightPool ))
    }

	return result;

}

function rInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ParameterChanged( param, value ) {
    switch ( param ) {
        case 0:
            // iteration length
            break;
        case 1:
            // target octave
            break;
        case 2:
            // pitch CHAIN_ASSIGNMENTS titles
            break;
        case 3:
            // I
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["I"];
            } else {
                CHAIN_ASSIGNMENTS["I"] = value - 1;
            }
            break;
        case 4:
            // II
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["II"];
            } else {
                CHAIN_ASSIGNMENTS["II"] = value - 1;
            }
            break;
        case 5:
            // III
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["III"];
            } else {
                CHAIN_ASSIGNMENTS["III"] = value - 1;
            }
            break;
        case 6:
            // IV
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["IV"];
            } else {
                CHAIN_ASSIGNMENTS["IV"] = value - 1;
            }
            break;
        case 7:
            // V
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["V"];
            } else {
                CHAIN_ASSIGNMENTS["V"] = value - 1;
            }
            break;
        case 8:
            // VI
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["VI"];
            } else {
                CHAIN_ASSIGNMENTS["VI"] = value - 1;
            }
            break;
        case 9:
            // VII
            if ( value == 0 ) {
                delete CHAIN_ASSIGNMENTS["VII"];
            } else {
                CHAIN_ASSIGNMENTS["VII"] = value - 1;
            }
            break;
        case 10:
            // example chains
            let keys = Object.keys(EXAMPLE_CHAINS);
            CHAIN = EXAMPLE_CHAINS[keys[value]];
            Trace(JSON.stringify(CHAIN));
            break;
        default:
            Trace("ERROR: ParameterChanged()");
            break;
    }
}

// 0 
PluginParameters.push({
	name:"Iteration Length", 
	type:"menu", 
	valueStrings:NOTE_LENGTH_KEYS, 
	defaultValue:NOTE_LENGTH_KEYS.length - 1
});

// 1
PluginParameters.push({
	name:"Target Octave", 
	type:"menu", 
	valueStrings:TARGET_OCTAVE_KEYS, 
	defaultValue:5
});

// 2
PluginParameters.push({
	name: "Chain Pitch Assignments",
	type: "text"
});

// 3
PluginParameters.push({
	name:"I", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:1
});

// 4
PluginParameters.push({
	name:"II", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:3
});

// 5
PluginParameters.push({
	name:"III", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:5
});

// 6
PluginParameters.push({
	name:"IV", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:6
});

// 7
PluginParameters.push({
	name:"V", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:8
});

// 8
PluginParameters.push({
	name:"VI", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:10
});

// 9
PluginParameters.push({
	name:"VII", 
	type:"menu", 
	valueStrings:["Off", "C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"], 
	defaultValue:12
});

PluginParameters.push({
    name:"Example Markov Chain",
    type:"menu",
    valueStrings:Object.keys(EXAMPLE_CHAINS),
    defaultValue:0
})