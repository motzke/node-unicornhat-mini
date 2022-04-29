var SPI = require('pi-spi');
var PIXELIZER = require('character-pixelizer')["5x7"];
/* nodejs implemention of
   https://github.com/pimoroni/unicornhatmini-python/blob/master/library/unicornhatmini/__init__.py
*/

//# Holtek HT16D35
const CMD_SOFT_RESET = 0xCC;
const CMD_GLOBAL_BRIGHTNESS = 0x37;
const CMD_COM_PIN_CTRL = 0x41;
const CMD_ROW_PIN_CTRL = 0x42;
const CMD_WRITE_DISPLAY = 0x80;
const CMD_READ_DISPLAY = 0x81;
const CMD_SYSTEM_CTRL = 0x35;
const CMD_SCROLL_CTRL = 0x20;

const BUTTON_A = 5;
const BUTTON_B = 6;
const BUTTON_X = 16;
const BUTTON_Y = 20;

function UnicornHatMini() {

    this.left_matrix = [SPI.initialize('/dev/spidev0.0'), 0];
    this.right_matrix = [SPI.initialize('/dev/spidev0.1'), (28 * 8)];

    this.lut = [[139, 138, 137], [223, 222, 221], [167, 166, 165], [195, 194, 193], [111, 110, 109], [55, 54, 53], [83, 82, 81], [136, 135, 134], [220, 219, 218], [164, 163, 162], [192, 191, 190], [108, 107, 106], [52, 51, 50], [80, 79, 78], [113, 115, 114], [197, 199, 198], [141, 143, 142], [169, 171, 170], [85, 87, 86], [29, 31, 30], [57, 59, 58], [116, 118, 117], [200, 202, 201], [144, 146, 145], [172, 174, 173], [88, 90, 89], [32, 34, 33], [60, 62, 61], [119, 121, 120], [203, 205, 204], [147, 149, 148], [175, 177, 176], [91, 93, 92], [35, 37, 36], [63, 65, 64], [122, 124, 123], [206, 208, 207], [150, 152, 151], [178, 180, 179], [94, 96, 95], [38, 40, 39], [66, 68, 67], [125, 127, 126], [209, 211, 210], [153, 155, 154], [181, 183, 182], [97, 99, 98], [41, 43, 42], [69, 71, 70], [128, 130, 129], [212, 214, 213], [156, 158, 157], [184, 186, 185], [100, 102, 101], [44, 46, 45], [72, 74, 73], [131, 133, 132], [215, 217, 216], [159, 161, 160], [187, 189, 188], [103, 105, 104], [47, 49, 48], [75, 77, 76], [363, 362, 361], [447, 446, 445], [391, 390, 389], [419, 418, 417], [335, 334, 333], [279, 278, 277], [307, 306, 305], [360, 359, 358], [444, 443, 442], [388, 387, 386], [416, 415, 414], [332, 331, 330], [276, 275, 274], [304, 303, 302], [337, 339, 338], [421, 423, 422], [365, 367, 366], [393, 395, 394], [309, 311, 310], [253, 255, 254], [281, 283, 282], [340, 342, 341], [424, 426, 425], [368, 370, 369], [396, 398, 397], [312, 314, 313], [256, 258, 257], [284, 286, 285], [343, 345, 344], [427, 429, 428], [371, 373, 372], [399, 401, 400], [315, 317, 316], [259, 261, 260], [287, 289, 288], [346, 348, 347], [430, 432, 431], [374, 376, 375], [402, 404, 403], [318, 320, 319], [262, 264, 263], [290, 292, 291], [349, 351, 350], [433, 435, 434], [377, 379, 378], [405, 407, 406], [321, 323, 322], [265, 267, 266], [293, 295, 294], [352, 354, 353], [436, 438, 437], [380, 382, 381], [408, 410, 409], [324, 326, 325], [268, 270, 269], [296, 298, 297]];


    this.COLS = 17; // x
    this.ROWS = 7;  // y
    this.NUM_PIXEL = (this.COLS * this.ROWS);

    this.disp = (new Array(this.COLS * this.ROWS)).fill([0,0,0]);
    this.buf = (new Array(28 * 8 * 2)).fill(0);

    this.rotation = 0;
    this.flipX = false; // COLS = 17
    this.flipY = false; // ROWS = 7
    this.brightness = 1.0;

    this.xferBoth([CMD_SOFT_RESET]);
    this.xferBoth([CMD_GLOBAL_BRIGHTNESS, 0x01]);
    this.xferBoth([CMD_SCROLL_CTRL, 0x00]);
    this.xferBoth([CMD_SYSTEM_CTRL, 0x00]);
    this.xferBoth([CMD_WRITE_DISPLAY, 0x00], this.buf, (28 * 8));
    this.xferBoth([CMD_COM_PIN_CTRL, 0xff]);
    this.xferBoth([CMD_ROW_PIN_CTRL, 0xff, 0xff, 0xff, 0xff]);
    this.xferBoth([CMD_SYSTEM_CTRL, 0x03]);

    this.busy = false;

}

UnicornHatMini.prototype.getDisplayPosition = function (x, y) {
    if(x >= 17 || y >= 7 || x < 0 || y < 0) {
      throw `invalid pixel: (${x},${y})`;
    }

    let xx = x;
    let yy = y;

    let flipXX = this.flipX;
    let flipYY = this.flipY;

    if (this.rotation === 180) {
      // rotation by 180 is like flipx and flipy
      flipXX = !flipXX;
      flipYY = !flipYY;

    } else if (this.rotation === 90) {
      xx = y;
      yy = (this.ROWS - x);
      [xx, yy] = this.cropOffset(xx, yy);
    } else if (this.rotation === 270) {
      xx = (this.COLS - y);
      yy = x;
      [xx, yy] = this.cropOffset(xx, yy);
    }

    if(flipXX) {
      // COLS = 17
      xx = (this.COLS - 1 - xx);
    }

    if(flipYY) {
      // ROWS = 7
      yy = (this.ROWS - 1 - yy);
    }


    //console.debug(`(${x},${y}) rotation of ${this.rotation} with flipX=${this.flipX} and flipY=${this.flipY} => (${xx},${yy})`);
    //console.debug(`(${xx} * ${this.ROWS}) + ${yy} = ${(xx * this.ROWS) + yy}`);
    return (xx * this.ROWS) + yy;
};
UnicornHatMini.prototype.cropOffset = function (x, y) {
    let xx = x;
    let yy = y;

    if(xx >= this.COLS) {
      xx = (this.COLS - 1);
    } else if (xx < 0) {
      xx = 0;
    }

    if(yy >= this.ROWS) {
      yy = (this.ROWS - 1);
    } else if (yy < 0) {
      yy = 0;
    } else {
    }
    //console.debug(`cropOffset : (${x}, ${y}) => (${xx}, ${yy})`);
    return [xx, yy];
};

UnicornHatMini.prototype.getOffset = function (x, y) {
  if(x >= 17 || y >= 7 || x < 0 || y < 0) {
    throw `invalid pixel: (${x},${y})`;
  }
  //console.debug(`(${x} * ${this.ROWS}) + ${y} = ${(x * this.ROWS) + y}`);
  return (x * this.ROWS) + y;
}

UnicornHatMini.prototype.doflipX = function () {
  this.flipX = !this.flipX; // COLS = 17
  console.log(`this.flipX = ${this.flipX}`);
};

UnicornHatMini.prototype.doflipY = function () {
  this.flipY = !this.flipY; // ROWS = 7
  console.log(`this.flipY = ${this.flipY}`);
};

UnicornHatMini.prototype.setRotation = function (rotation) {
  let validRotations = [0, 90, 180, 270];
  if (!validRotations.includes(rotation)) {
    throw `rotation must be one of ${validRotations}`;
  }
  this.rotation = rotation;
};

UnicornHatMini.prototype.getRotation = function () {
    return this.rotation;
};

UnicornHatMini.prototype.setBrightness = function (brightness) {
    this.brightness = brightness;
    this.xferBoth([CMD_GLOBAL_BRIGHTNESS, 63 * this.brightness]);
};

UnicornHatMini.prototype.getBrightness = function () {
    return this.brightness;
};

UnicornHatMini.prototype.sleep = async function (millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

UnicornHatMini.prototype.setAll = function (r, g, b) {
    if (r !== parseInt(r, 10)) {
        throw 'r must be an integer';
    }

    if (g !== parseInt(g, 10)) {
        throw 'r must be an integer';
    }

    if (b !== parseInt(b, 10)) {
        throw 'b must be an integer';
    }

    r >>= 2;
    g >>= 2;
    b >>= 2;

    for (var x=0; x<this.COLS; x++ ) {
      for (var y=0; y<this.ROWS; y++ ) {
        this.setPixel(x, y, r, g, b);
      }
    }
};

UnicornHatMini.prototype.getAll = function () {
  return this.disp;
};

UnicornHatMini.prototype.setPixel = function (x, y, r, g, b) {
    let offset = this.getOffset(x, y);
    this.disp[offset] = [r >> 2, g >> 2, b >> 2];
};

UnicornHatMini.prototype.getPixel = function (x, y) {
    let offset = this.getOffset(x, y);
    return this.disp[offset];
};

UnicornHatMini.prototype.clearPixel = function (x, y) {
    this.setPixel(x, y, 0, 0, 0);
};

UnicornHatMini.prototype.clear = function () {
    this.setAll(0, 0, 0);
};

UnicornHatMini.prototype.xfer = function (device, command) {
  device.write(new Buffer(command), function (err, data) {
      if (err) {
          throw 'Something went wrong!';
      }
      if(data) {
        console.log("returnung", data)
      }
  });
};

UnicornHatMini.prototype.xferBoth = function (command, data, length) {

  let lCommand, rCommand;
  let [lDevice, lOffset] = this.left_matrix;
  let [rDevice, rOffset] = this.right_matrix;

  if(data && length) {
    lCommand = new Buffer(command.concat(data.slice(lOffset, lOffset + length)));
    rCommand = new Buffer(command.concat(data.slice(rOffset, rOffset + length)));
  }
  else {
    lCommand = new Buffer(command);
    rCommand = new Buffer(command);
  }
  this.xfer(lDevice, lCommand);
  this.xfer(rDevice, rCommand);
};

UnicornHatMini.prototype.show = function () {

  this.buf = (new Array(28 * 8 * 2)).fill(0);

  for (var x=0; x<this.COLS; x++ ) {
    for (var y=0; y<this.ROWS; y++ ) {
      let index = this.getOffset(x, y);
      let displayPos = this.getDisplayPosition(x, y);

      let [ir, ig, ib] = this.lut[displayPos];
      let [r, g, b] = this.disp[index];

      this.buf[ir] = r;
      this.buf[ig] = g;
      this.buf[ib] = b;
      }
    }

    this.xferBoth([CMD_WRITE_DISPLAY, 0x00], this.buf, (28 * 8));

    this.xferBoth([CMD_GLOBAL_BRIGHTNESS, 63 * this.brightness]);


};


// fun stuff here:
UnicornHatMini.prototype.setRainBow = function () {
  for (var x=0; x<17 ; x++ ) {
    for (var y=0; y<7 ; y++ ) {
      //let r = Math.round(Math.random()*255);
      //let g = Math.round(Math.random()*255);
      //let b = Math.round(Math.random()*255);
      let r = ( x * 255 / 17 );
      let g = ( y * 255 / 7 );
      let b = (200 - g);
      this.setPixel(x, y, r, g, b);
    }
  }
};

UnicornHatMini.prototype.setLetter = function (char, position, scrollOut) {
  let validPosition = [1, 2, 3, 4]; // 4 is only usefull for scrolling...
  if (!validPosition.includes(position)) {
    throw `position must be one of ${validRotations}`;
  }
  if (!scrollOut) {
    scrollOut = 0;
  }
  const xOffset = ((position - 1) * (5 + 1));
  const yOffset = 0;
  for (var x=0; x<5 ; x++ ) {
    for (var y=0; y<7 ; y++ ) {
      //let r = Math.round(Math.random()*255);
      //let g = Math.round(Math.random()*255);
      //let b = Math.round(Math.random()*255);
      let r = ( x * 255 / 17 );
      let g = ( y * 255 / 7 );
      let b = (200 - g);
      if ((x + xOffset - scrollOut) >=0 && (x + xOffset - scrollOut) <=16) {
        if(PIXELIZER[char] && PIXELIZER[char][y][x]==1){
          this.setPixel(x + xOffset - scrollOut, y + yOffset, r, g, b);
        } else {
          this.clearPixel(x + xOffset - scrollOut, y + yOffset, r, g, b);
        }
      }
    }
  }

};

UnicornHatMini.prototype.scrollText = async function(text, scrollSpeed, loop, callBack) {
  if (!scrollSpeed){
    scrollSpeed = 100;
  }
  this.busy = true;
  this.clear();
  for (let i = 0; i < text.length; i+=1) {

      for (let j = 0; j < 6; j++) {
        this.clear();
        this.setLetter(text[i], 1, j);
        if (text[i+1]) {
          this.setLetter(text[i+1], 2, j);
        }
        if (text[i+2]) {
          this.setLetter(text[i+2], 3, j);
        }
        if (text[i+3]) {
          this.setLetter(text[i+3], 4, j);
        }
        this.show();
        await this.sleep(scrollSpeed)
      //console.log(text[i]+text[i+1]+text[i+2], ((i * 6) + j) * disaplayTime);
    }
  }
  this.busy = false;
  if(loop) {
    this.scrollText(text, scrollSpeed, loop);
  } else if(callBack) {
    callBack();
  }
};

module.exports = UnicornHatMini;
