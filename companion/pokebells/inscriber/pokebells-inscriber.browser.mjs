var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/base64-js/index.js
var require_base64_js = __commonJS({
  "node_modules/base64-js/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    exports.byteLength = byteLength;
    exports.toByteArray = toByteArray;
    exports.fromByteArray = fromByteArray;
    var lookup = [];
    var revLookup = [];
    var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
    var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i];
      revLookup[code.charCodeAt(i)] = i;
    }
    var i;
    var len;
    revLookup["-".charCodeAt(0)] = 62;
    revLookup["_".charCodeAt(0)] = 63;
    function getLens(b64) {
      var len2 = b64.length;
      if (len2 % 4 > 0) {
        throw new Error("Invalid string. Length must be a multiple of 4");
      }
      var validLen = b64.indexOf("=");
      if (validLen === -1) validLen = len2;
      var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
      return [validLen, placeHoldersLen];
    }
    function byteLength(b64) {
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function _byteLength(b64, validLen, placeHoldersLen) {
      return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
    }
    function toByteArray(b64) {
      var tmp;
      var lens = getLens(b64);
      var validLen = lens[0];
      var placeHoldersLen = lens[1];
      var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
      var curByte = 0;
      var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
      var i2;
      for (i2 = 0; i2 < len2; i2 += 4) {
        tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
        arr[curByte++] = tmp >> 16 & 255;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 2) {
        tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
        arr[curByte++] = tmp & 255;
      }
      if (placeHoldersLen === 1) {
        tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
        arr[curByte++] = tmp >> 8 & 255;
        arr[curByte++] = tmp & 255;
      }
      return arr;
    }
    function tripletToBase64(num) {
      return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
    }
    function encodeChunk(uint8, start, end) {
      var tmp;
      var output = [];
      for (var i2 = start; i2 < end; i2 += 3) {
        tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
        output.push(tripletToBase64(tmp));
      }
      return output.join("");
    }
    function fromByteArray(uint8) {
      var tmp;
      var len2 = uint8.length;
      var extraBytes = len2 % 3;
      var parts = [];
      var maxChunkLength = 16383;
      for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) {
        parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
      }
      if (extraBytes === 1) {
        tmp = uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
        );
      } else if (extraBytes === 2) {
        tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
        parts.push(
          lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
        );
      }
      return parts.join("");
    }
  }
});

// node_modules/ieee754/index.js
var require_ieee754 = __commonJS({
  "node_modules/ieee754/index.js"(exports) {
    init_buffer_shim();
    exports.read = function(buffer, offset, isLE, mLen, nBytes) {
      var e, m;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var nBits = -7;
      var i = isLE ? nBytes - 1 : 0;
      var d = isLE ? -1 : 1;
      var s = buffer[offset + i];
      i += d;
      e = s & (1 << -nBits) - 1;
      s >>= -nBits;
      nBits += eLen;
      for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      m = e & (1 << -nBits) - 1;
      e >>= -nBits;
      nBits += mLen;
      for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
      }
      if (e === 0) {
        e = 1 - eBias;
      } else if (e === eMax) {
        return m ? NaN : (s ? -1 : 1) * Infinity;
      } else {
        m = m + Math.pow(2, mLen);
        e = e - eBias;
      }
      return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    };
    exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
      var e, m, c;
      var eLen = nBytes * 8 - mLen - 1;
      var eMax = (1 << eLen) - 1;
      var eBias = eMax >> 1;
      var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
      var i = isLE ? 0 : nBytes - 1;
      var d = isLE ? 1 : -1;
      var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
      value = Math.abs(value);
      if (isNaN(value) || value === Infinity) {
        m = isNaN(value) ? 1 : 0;
        e = eMax;
      } else {
        e = Math.floor(Math.log(value) / Math.LN2);
        if (value * (c = Math.pow(2, -e)) < 1) {
          e--;
          c *= 2;
        }
        if (e + eBias >= 1) {
          value += rt / c;
        } else {
          value += rt * Math.pow(2, 1 - eBias);
        }
        if (value * c >= 2) {
          e++;
          c /= 2;
        }
        if (e + eBias >= eMax) {
          m = 0;
          e = eMax;
        } else if (e + eBias >= 1) {
          m = (value * c - 1) * Math.pow(2, mLen);
          e = e + eBias;
        } else {
          m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
          e = 0;
        }
      }
      for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
      }
      e = e << mLen | m;
      eLen += mLen;
      for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
      }
      buffer[offset + i - d] |= s * 128;
    };
  }
});

// node_modules/buffer/index.js
var require_buffer = __commonJS({
  "node_modules/buffer/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    var base64 = require_base64_js();
    var ieee754 = require_ieee754();
    var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
    exports.Buffer = Buffer3;
    exports.SlowBuffer = SlowBuffer;
    exports.INSPECT_MAX_BYTES = 50;
    var K_MAX_LENGTH = 2147483647;
    exports.kMaxLength = K_MAX_LENGTH;
    Buffer3.TYPED_ARRAY_SUPPORT = typedArraySupport();
    if (!Buffer3.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
      console.error(
        "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
      );
    }
    function typedArraySupport() {
      try {
        const arr = new Uint8Array(1);
        const proto = { foo: function() {
          return 42;
        } };
        Object.setPrototypeOf(proto, Uint8Array.prototype);
        Object.setPrototypeOf(arr, proto);
        return arr.foo() === 42;
      } catch (e) {
        return false;
      }
    }
    Object.defineProperty(Buffer3.prototype, "parent", {
      enumerable: true,
      get: function() {
        if (!Buffer3.isBuffer(this)) return void 0;
        return this.buffer;
      }
    });
    Object.defineProperty(Buffer3.prototype, "offset", {
      enumerable: true,
      get: function() {
        if (!Buffer3.isBuffer(this)) return void 0;
        return this.byteOffset;
      }
    });
    function createBuffer(length) {
      if (length > K_MAX_LENGTH) {
        throw new RangeError('The value "' + length + '" is invalid for option "size"');
      }
      const buf = new Uint8Array(length);
      Object.setPrototypeOf(buf, Buffer3.prototype);
      return buf;
    }
    function Buffer3(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        if (typeof encodingOrOffset === "string") {
          throw new TypeError(
            'The "string" argument must be of type string. Received type number'
          );
        }
        return allocUnsafe(arg);
      }
      return from(arg, encodingOrOffset, length);
    }
    Buffer3.poolSize = 8192;
    function from(value, encodingOrOffset, length) {
      if (typeof value === "string") {
        return fromString(value, encodingOrOffset);
      }
      if (ArrayBuffer.isView(value)) {
        return fromArrayView(value);
      }
      if (value == null) {
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
        return fromArrayBuffer(value, encodingOrOffset, length);
      }
      if (typeof value === "number") {
        throw new TypeError(
          'The "value" argument must not be of type number. Received type number'
        );
      }
      const valueOf = value.valueOf && value.valueOf();
      if (valueOf != null && valueOf !== value) {
        return Buffer3.from(valueOf, encodingOrOffset, length);
      }
      const b = fromObject(value);
      if (b) return b;
      if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
        return Buffer3.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
      }
      throw new TypeError(
        "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
      );
    }
    Buffer3.from = function(value, encodingOrOffset, length) {
      return from(value, encodingOrOffset, length);
    };
    Object.setPrototypeOf(Buffer3.prototype, Uint8Array.prototype);
    Object.setPrototypeOf(Buffer3, Uint8Array);
    function assertSize(size) {
      if (typeof size !== "number") {
        throw new TypeError('"size" argument must be of type number');
      } else if (size < 0) {
        throw new RangeError('The value "' + size + '" is invalid for option "size"');
      }
    }
    function alloc(size, fill, encoding) {
      assertSize(size);
      if (size <= 0) {
        return createBuffer(size);
      }
      if (fill !== void 0) {
        return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
      }
      return createBuffer(size);
    }
    Buffer3.alloc = function(size, fill, encoding) {
      return alloc(size, fill, encoding);
    };
    function allocUnsafe(size) {
      assertSize(size);
      return createBuffer(size < 0 ? 0 : checked(size) | 0);
    }
    Buffer3.allocUnsafe = function(size) {
      return allocUnsafe(size);
    };
    Buffer3.allocUnsafeSlow = function(size) {
      return allocUnsafe(size);
    };
    function fromString(string, encoding) {
      if (typeof encoding !== "string" || encoding === "") {
        encoding = "utf8";
      }
      if (!Buffer3.isEncoding(encoding)) {
        throw new TypeError("Unknown encoding: " + encoding);
      }
      const length = byteLength(string, encoding) | 0;
      let buf = createBuffer(length);
      const actual = buf.write(string, encoding);
      if (actual !== length) {
        buf = buf.slice(0, actual);
      }
      return buf;
    }
    function fromArrayLike(array) {
      const length = array.length < 0 ? 0 : checked(array.length) | 0;
      const buf = createBuffer(length);
      for (let i = 0; i < length; i += 1) {
        buf[i] = array[i] & 255;
      }
      return buf;
    }
    function fromArrayView(arrayView) {
      if (isInstance(arrayView, Uint8Array)) {
        const copy = new Uint8Array(arrayView);
        return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
      }
      return fromArrayLike(arrayView);
    }
    function fromArrayBuffer(array, byteOffset, length) {
      if (byteOffset < 0 || array.byteLength < byteOffset) {
        throw new RangeError('"offset" is outside of buffer bounds');
      }
      if (array.byteLength < byteOffset + (length || 0)) {
        throw new RangeError('"length" is outside of buffer bounds');
      }
      let buf;
      if (byteOffset === void 0 && length === void 0) {
        buf = new Uint8Array(array);
      } else if (length === void 0) {
        buf = new Uint8Array(array, byteOffset);
      } else {
        buf = new Uint8Array(array, byteOffset, length);
      }
      Object.setPrototypeOf(buf, Buffer3.prototype);
      return buf;
    }
    function fromObject(obj) {
      if (Buffer3.isBuffer(obj)) {
        const len = checked(obj.length) | 0;
        const buf = createBuffer(len);
        if (buf.length === 0) {
          return buf;
        }
        obj.copy(buf, 0, 0, len);
        return buf;
      }
      if (obj.length !== void 0) {
        if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
          return createBuffer(0);
        }
        return fromArrayLike(obj);
      }
      if (obj.type === "Buffer" && Array.isArray(obj.data)) {
        return fromArrayLike(obj.data);
      }
    }
    function checked(length) {
      if (length >= K_MAX_LENGTH) {
        throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
      }
      return length | 0;
    }
    function SlowBuffer(length) {
      if (+length != length) {
        length = 0;
      }
      return Buffer3.alloc(+length);
    }
    Buffer3.isBuffer = function isBuffer(b) {
      return b != null && b._isBuffer === true && b !== Buffer3.prototype;
    };
    Buffer3.compare = function compare(a, b) {
      if (isInstance(a, Uint8Array)) a = Buffer3.from(a, a.offset, a.byteLength);
      if (isInstance(b, Uint8Array)) b = Buffer3.from(b, b.offset, b.byteLength);
      if (!Buffer3.isBuffer(a) || !Buffer3.isBuffer(b)) {
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      }
      if (a === b) return 0;
      let x = a.length;
      let y = b.length;
      for (let i = 0, len = Math.min(x, y); i < len; ++i) {
        if (a[i] !== b[i]) {
          x = a[i];
          y = b[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    Buffer3.isEncoding = function isEncoding(encoding) {
      switch (String(encoding).toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "latin1":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return true;
        default:
          return false;
      }
    };
    Buffer3.concat = function concat(list, length) {
      if (!Array.isArray(list)) {
        throw new TypeError('"list" argument must be an Array of Buffers');
      }
      if (list.length === 0) {
        return Buffer3.alloc(0);
      }
      let i;
      if (length === void 0) {
        length = 0;
        for (i = 0; i < list.length; ++i) {
          length += list[i].length;
        }
      }
      const buffer = Buffer3.allocUnsafe(length);
      let pos = 0;
      for (i = 0; i < list.length; ++i) {
        let buf = list[i];
        if (isInstance(buf, Uint8Array)) {
          if (pos + buf.length > buffer.length) {
            if (!Buffer3.isBuffer(buf)) buf = Buffer3.from(buf);
            buf.copy(buffer, pos);
          } else {
            Uint8Array.prototype.set.call(
              buffer,
              buf,
              pos
            );
          }
        } else if (!Buffer3.isBuffer(buf)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        } else {
          buf.copy(buffer, pos);
        }
        pos += buf.length;
      }
      return buffer;
    };
    function byteLength(string, encoding) {
      if (Buffer3.isBuffer(string)) {
        return string.length;
      }
      if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
        return string.byteLength;
      }
      if (typeof string !== "string") {
        throw new TypeError(
          'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string
        );
      }
      const len = string.length;
      const mustMatch = arguments.length > 2 && arguments[2] === true;
      if (!mustMatch && len === 0) return 0;
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "ascii":
          case "latin1":
          case "binary":
            return len;
          case "utf8":
          case "utf-8":
            return utf8ToBytes(string).length;
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return len * 2;
          case "hex":
            return len >>> 1;
          case "base64":
            return base64ToBytes(string).length;
          default:
            if (loweredCase) {
              return mustMatch ? -1 : utf8ToBytes(string).length;
            }
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer3.byteLength = byteLength;
    function slowToString(encoding, start, end) {
      let loweredCase = false;
      if (start === void 0 || start < 0) {
        start = 0;
      }
      if (start > this.length) {
        return "";
      }
      if (end === void 0 || end > this.length) {
        end = this.length;
      }
      if (end <= 0) {
        return "";
      }
      end >>>= 0;
      start >>>= 0;
      if (end <= start) {
        return "";
      }
      if (!encoding) encoding = "utf8";
      while (true) {
        switch (encoding) {
          case "hex":
            return hexSlice(this, start, end);
          case "utf8":
          case "utf-8":
            return utf8Slice(this, start, end);
          case "ascii":
            return asciiSlice(this, start, end);
          case "latin1":
          case "binary":
            return latin1Slice(this, start, end);
          case "base64":
            return base64Slice(this, start, end);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return utf16leSlice(this, start, end);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = (encoding + "").toLowerCase();
            loweredCase = true;
        }
      }
    }
    Buffer3.prototype._isBuffer = true;
    function swap(b, n, m) {
      const i = b[n];
      b[n] = b[m];
      b[m] = i;
    }
    Buffer3.prototype.swap16 = function swap16() {
      const len = this.length;
      if (len % 2 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 16-bits");
      }
      for (let i = 0; i < len; i += 2) {
        swap(this, i, i + 1);
      }
      return this;
    };
    Buffer3.prototype.swap32 = function swap32() {
      const len = this.length;
      if (len % 4 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 32-bits");
      }
      for (let i = 0; i < len; i += 4) {
        swap(this, i, i + 3);
        swap(this, i + 1, i + 2);
      }
      return this;
    };
    Buffer3.prototype.swap64 = function swap64() {
      const len = this.length;
      if (len % 8 !== 0) {
        throw new RangeError("Buffer size must be a multiple of 64-bits");
      }
      for (let i = 0; i < len; i += 8) {
        swap(this, i, i + 7);
        swap(this, i + 1, i + 6);
        swap(this, i + 2, i + 5);
        swap(this, i + 3, i + 4);
      }
      return this;
    };
    Buffer3.prototype.toString = function toString() {
      const length = this.length;
      if (length === 0) return "";
      if (arguments.length === 0) return utf8Slice(this, 0, length);
      return slowToString.apply(this, arguments);
    };
    Buffer3.prototype.toLocaleString = Buffer3.prototype.toString;
    Buffer3.prototype.equals = function equals(b) {
      if (!Buffer3.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
      if (this === b) return true;
      return Buffer3.compare(this, b) === 0;
    };
    Buffer3.prototype.inspect = function inspect() {
      let str = "";
      const max = exports.INSPECT_MAX_BYTES;
      str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
      if (this.length > max) str += " ... ";
      return "<Buffer " + str + ">";
    };
    if (customInspectSymbol) {
      Buffer3.prototype[customInspectSymbol] = Buffer3.prototype.inspect;
    }
    Buffer3.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
      if (isInstance(target, Uint8Array)) {
        target = Buffer3.from(target, target.offset, target.byteLength);
      }
      if (!Buffer3.isBuffer(target)) {
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
        );
      }
      if (start === void 0) {
        start = 0;
      }
      if (end === void 0) {
        end = target ? target.length : 0;
      }
      if (thisStart === void 0) {
        thisStart = 0;
      }
      if (thisEnd === void 0) {
        thisEnd = this.length;
      }
      if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
        throw new RangeError("out of range index");
      }
      if (thisStart >= thisEnd && start >= end) {
        return 0;
      }
      if (thisStart >= thisEnd) {
        return -1;
      }
      if (start >= end) {
        return 1;
      }
      start >>>= 0;
      end >>>= 0;
      thisStart >>>= 0;
      thisEnd >>>= 0;
      if (this === target) return 0;
      let x = thisEnd - thisStart;
      let y = end - start;
      const len = Math.min(x, y);
      const thisCopy = this.slice(thisStart, thisEnd);
      const targetCopy = target.slice(start, end);
      for (let i = 0; i < len; ++i) {
        if (thisCopy[i] !== targetCopy[i]) {
          x = thisCopy[i];
          y = targetCopy[i];
          break;
        }
      }
      if (x < y) return -1;
      if (y < x) return 1;
      return 0;
    };
    function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
      if (buffer.length === 0) return -1;
      if (typeof byteOffset === "string") {
        encoding = byteOffset;
        byteOffset = 0;
      } else if (byteOffset > 2147483647) {
        byteOffset = 2147483647;
      } else if (byteOffset < -2147483648) {
        byteOffset = -2147483648;
      }
      byteOffset = +byteOffset;
      if (numberIsNaN(byteOffset)) {
        byteOffset = dir ? 0 : buffer.length - 1;
      }
      if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
      if (byteOffset >= buffer.length) {
        if (dir) return -1;
        else byteOffset = buffer.length - 1;
      } else if (byteOffset < 0) {
        if (dir) byteOffset = 0;
        else return -1;
      }
      if (typeof val === "string") {
        val = Buffer3.from(val, encoding);
      }
      if (Buffer3.isBuffer(val)) {
        if (val.length === 0) {
          return -1;
        }
        return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
      } else if (typeof val === "number") {
        val = val & 255;
        if (typeof Uint8Array.prototype.indexOf === "function") {
          if (dir) {
            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
          } else {
            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
          }
        }
        return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
      }
      throw new TypeError("val must be string, number or Buffer");
    }
    function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
      let indexSize = 1;
      let arrLength = arr.length;
      let valLength = val.length;
      if (encoding !== void 0) {
        encoding = String(encoding).toLowerCase();
        if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
          if (arr.length < 2 || val.length < 2) {
            return -1;
          }
          indexSize = 2;
          arrLength /= 2;
          valLength /= 2;
          byteOffset /= 2;
        }
      }
      function read(buf, i2) {
        if (indexSize === 1) {
          return buf[i2];
        } else {
          return buf.readUInt16BE(i2 * indexSize);
        }
      }
      let i;
      if (dir) {
        let foundIndex = -1;
        for (i = byteOffset; i < arrLength; i++) {
          if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
            if (foundIndex === -1) foundIndex = i;
            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
          } else {
            if (foundIndex !== -1) i -= i - foundIndex;
            foundIndex = -1;
          }
        }
      } else {
        if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
        for (i = byteOffset; i >= 0; i--) {
          let found = true;
          for (let j = 0; j < valLength; j++) {
            if (read(arr, i + j) !== read(val, j)) {
              found = false;
              break;
            }
          }
          if (found) return i;
        }
      }
      return -1;
    }
    Buffer3.prototype.includes = function includes(val, byteOffset, encoding) {
      return this.indexOf(val, byteOffset, encoding) !== -1;
    };
    Buffer3.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
    };
    Buffer3.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
      return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
    };
    function hexWrite(buf, string, offset, length) {
      offset = Number(offset) || 0;
      const remaining = buf.length - offset;
      if (!length) {
        length = remaining;
      } else {
        length = Number(length);
        if (length > remaining) {
          length = remaining;
        }
      }
      const strLen = string.length;
      if (length > strLen / 2) {
        length = strLen / 2;
      }
      let i;
      for (i = 0; i < length; ++i) {
        const parsed = parseInt(string.substr(i * 2, 2), 16);
        if (numberIsNaN(parsed)) return i;
        buf[offset + i] = parsed;
      }
      return i;
    }
    function utf8Write(buf, string, offset, length) {
      return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
    }
    function asciiWrite(buf, string, offset, length) {
      return blitBuffer(asciiToBytes(string), buf, offset, length);
    }
    function base64Write(buf, string, offset, length) {
      return blitBuffer(base64ToBytes(string), buf, offset, length);
    }
    function ucs2Write(buf, string, offset, length) {
      return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
    }
    Buffer3.prototype.write = function write(string, offset, length, encoding) {
      if (offset === void 0) {
        encoding = "utf8";
        length = this.length;
        offset = 0;
      } else if (length === void 0 && typeof offset === "string") {
        encoding = offset;
        length = this.length;
        offset = 0;
      } else if (isFinite(offset)) {
        offset = offset >>> 0;
        if (isFinite(length)) {
          length = length >>> 0;
          if (encoding === void 0) encoding = "utf8";
        } else {
          encoding = length;
          length = void 0;
        }
      } else {
        throw new Error(
          "Buffer.write(string, encoding, offset[, length]) is no longer supported"
        );
      }
      const remaining = this.length - offset;
      if (length === void 0 || length > remaining) length = remaining;
      if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
        throw new RangeError("Attempt to write outside buffer bounds");
      }
      if (!encoding) encoding = "utf8";
      let loweredCase = false;
      for (; ; ) {
        switch (encoding) {
          case "hex":
            return hexWrite(this, string, offset, length);
          case "utf8":
          case "utf-8":
            return utf8Write(this, string, offset, length);
          case "ascii":
          case "latin1":
          case "binary":
            return asciiWrite(this, string, offset, length);
          case "base64":
            return base64Write(this, string, offset, length);
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return ucs2Write(this, string, offset, length);
          default:
            if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
            encoding = ("" + encoding).toLowerCase();
            loweredCase = true;
        }
      }
    };
    Buffer3.prototype.toJSON = function toJSON() {
      return {
        type: "Buffer",
        data: Array.prototype.slice.call(this._arr || this, 0)
      };
    };
    function base64Slice(buf, start, end) {
      if (start === 0 && end === buf.length) {
        return base64.fromByteArray(buf);
      } else {
        return base64.fromByteArray(buf.slice(start, end));
      }
    }
    function utf8Slice(buf, start, end) {
      end = Math.min(buf.length, end);
      const res = [];
      let i = start;
      while (i < end) {
        const firstByte = buf[i];
        let codePoint = null;
        let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
        if (i + bytesPerSequence <= end) {
          let secondByte, thirdByte, fourthByte, tempCodePoint;
          switch (bytesPerSequence) {
            case 1:
              if (firstByte < 128) {
                codePoint = firstByte;
              }
              break;
            case 2:
              secondByte = buf[i + 1];
              if ((secondByte & 192) === 128) {
                tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                if (tempCodePoint > 127) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 3:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                  codePoint = tempCodePoint;
                }
              }
              break;
            case 4:
              secondByte = buf[i + 1];
              thirdByte = buf[i + 2];
              fourthByte = buf[i + 3];
              if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                  codePoint = tempCodePoint;
                }
              }
          }
        }
        if (codePoint === null) {
          codePoint = 65533;
          bytesPerSequence = 1;
        } else if (codePoint > 65535) {
          codePoint -= 65536;
          res.push(codePoint >>> 10 & 1023 | 55296);
          codePoint = 56320 | codePoint & 1023;
        }
        res.push(codePoint);
        i += bytesPerSequence;
      }
      return decodeCodePointsArray(res);
    }
    var MAX_ARGUMENTS_LENGTH = 4096;
    function decodeCodePointsArray(codePoints) {
      const len = codePoints.length;
      if (len <= MAX_ARGUMENTS_LENGTH) {
        return String.fromCharCode.apply(String, codePoints);
      }
      let res = "";
      let i = 0;
      while (i < len) {
        res += String.fromCharCode.apply(
          String,
          codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
        );
      }
      return res;
    }
    function asciiSlice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i] & 127);
      }
      return ret;
    }
    function latin1Slice(buf, start, end) {
      let ret = "";
      end = Math.min(buf.length, end);
      for (let i = start; i < end; ++i) {
        ret += String.fromCharCode(buf[i]);
      }
      return ret;
    }
    function hexSlice(buf, start, end) {
      const len = buf.length;
      if (!start || start < 0) start = 0;
      if (!end || end < 0 || end > len) end = len;
      let out = "";
      for (let i = start; i < end; ++i) {
        out += hexSliceLookupTable[buf[i]];
      }
      return out;
    }
    function utf16leSlice(buf, start, end) {
      const bytes = buf.slice(start, end);
      let res = "";
      for (let i = 0; i < bytes.length - 1; i += 2) {
        res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
      }
      return res;
    }
    Buffer3.prototype.slice = function slice(start, end) {
      const len = this.length;
      start = ~~start;
      end = end === void 0 ? len : ~~end;
      if (start < 0) {
        start += len;
        if (start < 0) start = 0;
      } else if (start > len) {
        start = len;
      }
      if (end < 0) {
        end += len;
        if (end < 0) end = 0;
      } else if (end > len) {
        end = len;
      }
      if (end < start) end = start;
      const newBuf = this.subarray(start, end);
      Object.setPrototypeOf(newBuf, Buffer3.prototype);
      return newBuf;
    };
    function checkOffset(offset, ext, length) {
      if (offset % 1 !== 0 || offset < 0) throw new RangeError("offset is not uint");
      if (offset + ext > length) throw new RangeError("Trying to access beyond buffer length");
    }
    Buffer3.prototype.readUintLE = Buffer3.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      return val;
    };
    Buffer3.prototype.readUintBE = Buffer3.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        checkOffset(offset, byteLength2, this.length);
      }
      let val = this[offset + --byteLength2];
      let mul = 1;
      while (byteLength2 > 0 && (mul *= 256)) {
        val += this[offset + --byteLength2] * mul;
      }
      return val;
    };
    Buffer3.prototype.readUint8 = Buffer3.prototype.readUInt8 = function readUInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      return this[offset];
    };
    Buffer3.prototype.readUint16LE = Buffer3.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] | this[offset + 1] << 8;
    };
    Buffer3.prototype.readUint16BE = Buffer3.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      return this[offset] << 8 | this[offset + 1];
    };
    Buffer3.prototype.readUint32LE = Buffer3.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
    };
    Buffer3.prototype.readUint32BE = Buffer3.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
    };
    Buffer3.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const lo = first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24;
      const hi = this[++offset] + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + last * 2 ** 24;
      return BigInt(lo) + (BigInt(hi) << BigInt(32));
    });
    Buffer3.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const hi = first * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      const lo = this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last;
      return (BigInt(hi) << BigInt(32)) + BigInt(lo);
    });
    Buffer3.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let val = this[offset];
      let mul = 1;
      let i = 0;
      while (++i < byteLength2 && (mul *= 256)) {
        val += this[offset + i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer3.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) checkOffset(offset, byteLength2, this.length);
      let i = byteLength2;
      let mul = 1;
      let val = this[offset + --i];
      while (i > 0 && (mul *= 256)) {
        val += this[offset + --i] * mul;
      }
      mul *= 128;
      if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
      return val;
    };
    Buffer3.prototype.readInt8 = function readInt8(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 1, this.length);
      if (!(this[offset] & 128)) return this[offset];
      return (255 - this[offset] + 1) * -1;
    };
    Buffer3.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset] | this[offset + 1] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer3.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 2, this.length);
      const val = this[offset + 1] | this[offset] << 8;
      return val & 32768 ? val | 4294901760 : val;
    };
    Buffer3.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
    };
    Buffer3.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
    };
    Buffer3.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = this[offset + 4] + this[offset + 5] * 2 ** 8 + this[offset + 6] * 2 ** 16 + (last << 24);
      return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 2 ** 8 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 24);
    });
    Buffer3.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset) {
      offset = offset >>> 0;
      validateNumber(offset, "offset");
      const first = this[offset];
      const last = this[offset + 7];
      if (first === void 0 || last === void 0) {
        boundsError(offset, this.length - 8);
      }
      const val = (first << 24) + // Overflow
      this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + this[++offset];
      return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 2 ** 24 + this[++offset] * 2 ** 16 + this[++offset] * 2 ** 8 + last);
    });
    Buffer3.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, true, 23, 4);
    };
    Buffer3.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 4, this.length);
      return ieee754.read(this, offset, false, 23, 4);
    };
    Buffer3.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, true, 52, 8);
    };
    Buffer3.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
      offset = offset >>> 0;
      if (!noAssert) checkOffset(offset, 8, this.length);
      return ieee754.read(this, offset, false, 52, 8);
    };
    function checkInt(buf, value, offset, ext, max, min) {
      if (!Buffer3.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
      if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
    }
    Buffer3.prototype.writeUintLE = Buffer3.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let mul = 1;
      let i = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer3.prototype.writeUintBE = Buffer3.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      byteLength2 = byteLength2 >>> 0;
      if (!noAssert) {
        const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
        checkInt(this, value, offset, byteLength2, maxBytes, 0);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        this[offset + i] = value / mul & 255;
      }
      return offset + byteLength2;
    };
    Buffer3.prototype.writeUint8 = Buffer3.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 255, 0);
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer3.prototype.writeUint16LE = Buffer3.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer3.prototype.writeUint16BE = Buffer3.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 65535, 0);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer3.prototype.writeUint32LE = Buffer3.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset + 3] = value >>> 24;
      this[offset + 2] = value >>> 16;
      this[offset + 1] = value >>> 8;
      this[offset] = value & 255;
      return offset + 4;
    };
    Buffer3.prototype.writeUint32BE = Buffer3.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 4294967295, 0);
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    function wrtBigUInt64LE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      lo = lo >> 8;
      buf[offset++] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      hi = hi >> 8;
      buf[offset++] = hi;
      return offset;
    }
    function wrtBigUInt64BE(buf, value, offset, min, max) {
      checkIntBI(value, min, max, buf, offset, 7);
      let lo = Number(value & BigInt(4294967295));
      buf[offset + 7] = lo;
      lo = lo >> 8;
      buf[offset + 6] = lo;
      lo = lo >> 8;
      buf[offset + 5] = lo;
      lo = lo >> 8;
      buf[offset + 4] = lo;
      let hi = Number(value >> BigInt(32) & BigInt(4294967295));
      buf[offset + 3] = hi;
      hi = hi >> 8;
      buf[offset + 2] = hi;
      hi = hi >> 8;
      buf[offset + 1] = hi;
      hi = hi >> 8;
      buf[offset] = hi;
      return offset + 8;
    }
    Buffer3.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer3.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
    });
    Buffer3.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = 0;
      let mul = 1;
      let sub = 0;
      this[offset] = value & 255;
      while (++i < byteLength2 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer3.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        const limit = Math.pow(2, 8 * byteLength2 - 1);
        checkInt(this, value, offset, byteLength2, limit - 1, -limit);
      }
      let i = byteLength2 - 1;
      let mul = 1;
      let sub = 0;
      this[offset + i] = value & 255;
      while (--i >= 0 && (mul *= 256)) {
        if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
          sub = 1;
        }
        this[offset + i] = (value / mul >> 0) - sub & 255;
      }
      return offset + byteLength2;
    };
    Buffer3.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 1, 127, -128);
      if (value < 0) value = 255 + value + 1;
      this[offset] = value & 255;
      return offset + 1;
    };
    Buffer3.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      return offset + 2;
    };
    Buffer3.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 2, 32767, -32768);
      this[offset] = value >>> 8;
      this[offset + 1] = value & 255;
      return offset + 2;
    };
    Buffer3.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      this[offset] = value & 255;
      this[offset + 1] = value >>> 8;
      this[offset + 2] = value >>> 16;
      this[offset + 3] = value >>> 24;
      return offset + 4;
    };
    Buffer3.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) checkInt(this, value, offset, 4, 2147483647, -2147483648);
      if (value < 0) value = 4294967295 + value + 1;
      this[offset] = value >>> 24;
      this[offset + 1] = value >>> 16;
      this[offset + 2] = value >>> 8;
      this[offset + 3] = value & 255;
      return offset + 4;
    };
    Buffer3.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset = 0) {
      return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    Buffer3.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset = 0) {
      return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
    });
    function checkIEEE754(buf, value, offset, ext, max, min) {
      if (offset + ext > buf.length) throw new RangeError("Index out of range");
      if (offset < 0) throw new RangeError("Index out of range");
    }
    function writeFloat(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 4, 34028234663852886e22, -34028234663852886e22);
      }
      ieee754.write(buf, value, offset, littleEndian, 23, 4);
      return offset + 4;
    }
    Buffer3.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
      return writeFloat(this, value, offset, true, noAssert);
    };
    Buffer3.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
      return writeFloat(this, value, offset, false, noAssert);
    };
    function writeDouble(buf, value, offset, littleEndian, noAssert) {
      value = +value;
      offset = offset >>> 0;
      if (!noAssert) {
        checkIEEE754(buf, value, offset, 8, 17976931348623157e292, -17976931348623157e292);
      }
      ieee754.write(buf, value, offset, littleEndian, 52, 8);
      return offset + 8;
    }
    Buffer3.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
      return writeDouble(this, value, offset, true, noAssert);
    };
    Buffer3.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
      return writeDouble(this, value, offset, false, noAssert);
    };
    Buffer3.prototype.copy = function copy(target, targetStart, start, end) {
      if (!Buffer3.isBuffer(target)) throw new TypeError("argument should be a Buffer");
      if (!start) start = 0;
      if (!end && end !== 0) end = this.length;
      if (targetStart >= target.length) targetStart = target.length;
      if (!targetStart) targetStart = 0;
      if (end > 0 && end < start) end = start;
      if (end === start) return 0;
      if (target.length === 0 || this.length === 0) return 0;
      if (targetStart < 0) {
        throw new RangeError("targetStart out of bounds");
      }
      if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
      if (end < 0) throw new RangeError("sourceEnd out of bounds");
      if (end > this.length) end = this.length;
      if (target.length - targetStart < end - start) {
        end = target.length - targetStart + start;
      }
      const len = end - start;
      if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
        this.copyWithin(targetStart, start, end);
      } else {
        Uint8Array.prototype.set.call(
          target,
          this.subarray(start, end),
          targetStart
        );
      }
      return len;
    };
    Buffer3.prototype.fill = function fill(val, start, end, encoding) {
      if (typeof val === "string") {
        if (typeof start === "string") {
          encoding = start;
          start = 0;
          end = this.length;
        } else if (typeof end === "string") {
          encoding = end;
          end = this.length;
        }
        if (encoding !== void 0 && typeof encoding !== "string") {
          throw new TypeError("encoding must be a string");
        }
        if (typeof encoding === "string" && !Buffer3.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        if (val.length === 1) {
          const code = val.charCodeAt(0);
          if (encoding === "utf8" && code < 128 || encoding === "latin1") {
            val = code;
          }
        }
      } else if (typeof val === "number") {
        val = val & 255;
      } else if (typeof val === "boolean") {
        val = Number(val);
      }
      if (start < 0 || this.length < start || this.length < end) {
        throw new RangeError("Out of range index");
      }
      if (end <= start) {
        return this;
      }
      start = start >>> 0;
      end = end === void 0 ? this.length : end >>> 0;
      if (!val) val = 0;
      let i;
      if (typeof val === "number") {
        for (i = start; i < end; ++i) {
          this[i] = val;
        }
      } else {
        const bytes = Buffer3.isBuffer(val) ? val : Buffer3.from(val, encoding);
        const len = bytes.length;
        if (len === 0) {
          throw new TypeError('The value "' + val + '" is invalid for argument "value"');
        }
        for (i = 0; i < end - start; ++i) {
          this[i + start] = bytes[i % len];
        }
      }
      return this;
    };
    var errors = {};
    function E(sym, getMessage, Base) {
      errors[sym] = class NodeError extends Base {
        constructor() {
          super();
          Object.defineProperty(this, "message", {
            value: getMessage.apply(this, arguments),
            writable: true,
            configurable: true
          });
          this.name = `${this.name} [${sym}]`;
          this.stack;
          delete this.name;
        }
        get code() {
          return sym;
        }
        set code(value) {
          Object.defineProperty(this, "code", {
            configurable: true,
            enumerable: true,
            value,
            writable: true
          });
        }
        toString() {
          return `${this.name} [${sym}]: ${this.message}`;
        }
      };
    }
    E(
      "ERR_BUFFER_OUT_OF_BOUNDS",
      function(name) {
        if (name) {
          return `${name} is outside of buffer bounds`;
        }
        return "Attempt to access memory outside buffer bounds";
      },
      RangeError
    );
    E(
      "ERR_INVALID_ARG_TYPE",
      function(name, actual) {
        return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
      },
      TypeError
    );
    E(
      "ERR_OUT_OF_RANGE",
      function(str, range, input) {
        let msg = `The value of "${str}" is out of range.`;
        let received = input;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
          received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
          received = String(input);
          if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
            received = addNumericalSeparator(received);
          }
          received += "n";
        }
        msg += ` It must be ${range}. Received ${received}`;
        return msg;
      },
      RangeError
    );
    function addNumericalSeparator(val) {
      let res = "";
      let i = val.length;
      const start = val[0] === "-" ? 1 : 0;
      for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
      }
      return `${val.slice(0, i)}${res}`;
    }
    function checkBounds(buf, offset, byteLength2) {
      validateNumber(offset, "offset");
      if (buf[offset] === void 0 || buf[offset + byteLength2] === void 0) {
        boundsError(offset, buf.length - (byteLength2 + 1));
      }
    }
    function checkIntBI(value, min, max, buf, offset, byteLength2) {
      if (value > max || value < min) {
        const n = typeof min === "bigint" ? "n" : "";
        let range;
        if (byteLength2 > 3) {
          if (min === 0 || min === BigInt(0)) {
            range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
          } else {
            range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
          }
        } else {
          range = `>= ${min}${n} and <= ${max}${n}`;
        }
        throw new errors.ERR_OUT_OF_RANGE("value", range, value);
      }
      checkBounds(buf, offset, byteLength2);
    }
    function validateNumber(value, name) {
      if (typeof value !== "number") {
        throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
    }
    function boundsError(value, length, type) {
      if (Math.floor(value) !== value) {
        validateNumber(value, type);
        throw new errors.ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
      }
      if (length < 0) {
        throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
      }
      throw new errors.ERR_OUT_OF_RANGE(
        type || "offset",
        `>= ${type ? 1 : 0} and <= ${length}`,
        value
      );
    }
    var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
    function base64clean(str) {
      str = str.split("=")[0];
      str = str.trim().replace(INVALID_BASE64_RE, "");
      if (str.length < 2) return "";
      while (str.length % 4 !== 0) {
        str = str + "=";
      }
      return str;
    }
    function utf8ToBytes(string, units) {
      units = units || Infinity;
      let codePoint;
      const length = string.length;
      let leadSurrogate = null;
      const bytes = [];
      for (let i = 0; i < length; ++i) {
        codePoint = string.charCodeAt(i);
        if (codePoint > 55295 && codePoint < 57344) {
          if (!leadSurrogate) {
            if (codePoint > 56319) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            } else if (i + 1 === length) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              continue;
            }
            leadSurrogate = codePoint;
            continue;
          }
          if (codePoint < 56320) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
            leadSurrogate = codePoint;
            continue;
          }
          codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
        } else if (leadSurrogate) {
          if ((units -= 3) > -1) bytes.push(239, 191, 189);
        }
        leadSurrogate = null;
        if (codePoint < 128) {
          if ((units -= 1) < 0) break;
          bytes.push(codePoint);
        } else if (codePoint < 2048) {
          if ((units -= 2) < 0) break;
          bytes.push(
            codePoint >> 6 | 192,
            codePoint & 63 | 128
          );
        } else if (codePoint < 65536) {
          if ((units -= 3) < 0) break;
          bytes.push(
            codePoint >> 12 | 224,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else if (codePoint < 1114112) {
          if ((units -= 4) < 0) break;
          bytes.push(
            codePoint >> 18 | 240,
            codePoint >> 12 & 63 | 128,
            codePoint >> 6 & 63 | 128,
            codePoint & 63 | 128
          );
        } else {
          throw new Error("Invalid code point");
        }
      }
      return bytes;
    }
    function asciiToBytes(str) {
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        byteArray.push(str.charCodeAt(i) & 255);
      }
      return byteArray;
    }
    function utf16leToBytes(str, units) {
      let c, hi, lo;
      const byteArray = [];
      for (let i = 0; i < str.length; ++i) {
        if ((units -= 2) < 0) break;
        c = str.charCodeAt(i);
        hi = c >> 8;
        lo = c % 256;
        byteArray.push(lo);
        byteArray.push(hi);
      }
      return byteArray;
    }
    function base64ToBytes(str) {
      return base64.toByteArray(base64clean(str));
    }
    function blitBuffer(src, dst, offset, length) {
      let i;
      for (i = 0; i < length; ++i) {
        if (i + offset >= dst.length || i >= src.length) break;
        dst[i + offset] = src[i];
      }
      return i;
    }
    function isInstance(obj, type) {
      return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
    }
    function numberIsNaN(obj) {
      return obj !== obj;
    }
    var hexSliceLookupTable = (function() {
      const alphabet = "0123456789abcdef";
      const table = new Array(256);
      for (let i = 0; i < 16; ++i) {
        const i16 = i * 16;
        for (let j = 0; j < 16; ++j) {
          table[i16 + j] = alphabet[i] + alphabet[j];
        }
      }
      return table;
    })();
    function defineBigIntMethod(fn) {
      return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
    }
    function BufferBigIntNotDefined() {
      throw new Error("BigInt not supported");
    }
  }
});

// src/buffer-shim.mjs
var import_buffer, Buffer2;
var init_buffer_shim = __esm({
  "src/buffer-shim.mjs"() {
    import_buffer = __toESM(require_buffer(), 1);
    if (typeof globalThis.Buffer === "undefined") {
      globalThis.Buffer = import_buffer.Buffer;
    }
    if (typeof globalThis.process === "undefined") {
      globalThis.process = { env: {} };
    }
    Buffer2 = import_buffer.Buffer;
  }
});

// node_modules/belcoinjs-lib/src/networks.js
var require_networks = __commonJS({
  "node_modules/belcoinjs-lib/src/networks.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.testnet = exports.bellcoin = void 0;
    exports.bellcoin = {
      messagePrefix: "Bells Signed Message:\n",
      bech32: "bel",
      bip32: {
        public: 49990397,
        private: 49988504
      },
      pubKeyHash: 25,
      scriptHash: 30,
      wif: 153
    };
    exports.testnet = {
      messagePrefix: "Bells Signed Message:\n",
      bech32: "tbel",
      bip32: {
        public: 49990397,
        private: 49988504
      },
      pubKeyHash: 33,
      scriptHash: 22,
      wif: 158
    };
  }
});

// node_modules/belcoinjs-lib/src/bip66.js
var require_bip66 = __commonJS({
  "node_modules/belcoinjs-lib/src/bip66.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.encode = exports.decode = exports.check = void 0;
    function check(buffer) {
      if (buffer.length < 8) return false;
      if (buffer.length > 72) return false;
      if (buffer[0] !== 48) return false;
      if (buffer[1] !== buffer.length - 2) return false;
      if (buffer[2] !== 2) return false;
      const lenR = buffer[3];
      if (lenR === 0) return false;
      if (5 + lenR >= buffer.length) return false;
      if (buffer[4 + lenR] !== 2) return false;
      const lenS = buffer[5 + lenR];
      if (lenS === 0) return false;
      if (6 + lenR + lenS !== buffer.length) return false;
      if (buffer[4] & 128) return false;
      if (lenR > 1 && buffer[4] === 0 && !(buffer[5] & 128)) return false;
      if (buffer[lenR + 6] & 128) return false;
      if (lenS > 1 && buffer[lenR + 6] === 0 && !(buffer[lenR + 7] & 128))
        return false;
      return true;
    }
    exports.check = check;
    function decode(buffer) {
      if (buffer.length < 8) throw new Error("DER sequence length is too short");
      if (buffer.length > 72) throw new Error("DER sequence length is too long");
      if (buffer[0] !== 48) throw new Error("Expected DER sequence");
      if (buffer[1] !== buffer.length - 2)
        throw new Error("DER sequence length is invalid");
      if (buffer[2] !== 2) throw new Error("Expected DER integer");
      const lenR = buffer[3];
      if (lenR === 0) throw new Error("R length is zero");
      if (5 + lenR >= buffer.length) throw new Error("R length is too long");
      if (buffer[4 + lenR] !== 2) throw new Error("Expected DER integer (2)");
      const lenS = buffer[5 + lenR];
      if (lenS === 0) throw new Error("S length is zero");
      if (6 + lenR + lenS !== buffer.length) throw new Error("S length is invalid");
      if (buffer[4] & 128) throw new Error("R value is negative");
      if (lenR > 1 && buffer[4] === 0 && !(buffer[5] & 128))
        throw new Error("R value excessively padded");
      if (buffer[lenR + 6] & 128) throw new Error("S value is negative");
      if (lenS > 1 && buffer[lenR + 6] === 0 && !(buffer[lenR + 7] & 128))
        throw new Error("S value excessively padded");
      return {
        r: buffer.slice(4, 4 + lenR),
        s: buffer.slice(6 + lenR)
      };
    }
    exports.decode = decode;
    function encode(r, s) {
      const lenR = r.length;
      const lenS = s.length;
      if (lenR === 0) throw new Error("R length is zero");
      if (lenS === 0) throw new Error("S length is zero");
      if (lenR > 33) throw new Error("R length is too long");
      if (lenS > 33) throw new Error("S length is too long");
      if (r[0] & 128) throw new Error("R value is negative");
      if (s[0] & 128) throw new Error("S value is negative");
      if (lenR > 1 && r[0] === 0 && !(r[1] & 128))
        throw new Error("R value excessively padded");
      if (lenS > 1 && s[0] === 0 && !(s[1] & 128))
        throw new Error("S value excessively padded");
      const signature = Buffer2.allocUnsafe(6 + lenR + lenS);
      signature[0] = 48;
      signature[1] = signature.length - 2;
      signature[2] = 2;
      signature[3] = r.length;
      r.copy(signature, 4);
      signature[4 + lenR] = 2;
      signature[5 + lenR] = s.length;
      s.copy(signature, 6 + lenR);
      return signature;
    }
    exports.encode = encode;
  }
});

// node_modules/belcoinjs-lib/src/ops.js
var require_ops = __commonJS({
  "node_modules/belcoinjs-lib/src/ops.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.REVERSE_OPS = exports.OPS = void 0;
    var OPS = {
      OP_FALSE: 0,
      OP_0: 0,
      OP_PUSHDATA1: 76,
      OP_PUSHDATA2: 77,
      OP_PUSHDATA4: 78,
      OP_1NEGATE: 79,
      OP_RESERVED: 80,
      OP_TRUE: 81,
      OP_1: 81,
      OP_2: 82,
      OP_3: 83,
      OP_4: 84,
      OP_5: 85,
      OP_6: 86,
      OP_7: 87,
      OP_8: 88,
      OP_9: 89,
      OP_10: 90,
      OP_11: 91,
      OP_12: 92,
      OP_13: 93,
      OP_14: 94,
      OP_15: 95,
      OP_16: 96,
      OP_NOP: 97,
      OP_VER: 98,
      OP_IF: 99,
      OP_NOTIF: 100,
      OP_VERIF: 101,
      OP_VERNOTIF: 102,
      OP_ELSE: 103,
      OP_ENDIF: 104,
      OP_VERIFY: 105,
      OP_RETURN: 106,
      OP_TOALTSTACK: 107,
      OP_FROMALTSTACK: 108,
      OP_2DROP: 109,
      OP_2DUP: 110,
      OP_3DUP: 111,
      OP_2OVER: 112,
      OP_2ROT: 113,
      OP_2SWAP: 114,
      OP_IFDUP: 115,
      OP_DEPTH: 116,
      OP_DROP: 117,
      OP_DUP: 118,
      OP_NIP: 119,
      OP_OVER: 120,
      OP_PICK: 121,
      OP_ROLL: 122,
      OP_ROT: 123,
      OP_SWAP: 124,
      OP_TUCK: 125,
      OP_CAT: 126,
      OP_SUBSTR: 127,
      OP_LEFT: 128,
      OP_RIGHT: 129,
      OP_SIZE: 130,
      OP_INVERT: 131,
      OP_AND: 132,
      OP_OR: 133,
      OP_XOR: 134,
      OP_EQUAL: 135,
      OP_EQUALVERIFY: 136,
      OP_RESERVED1: 137,
      OP_RESERVED2: 138,
      OP_1ADD: 139,
      OP_1SUB: 140,
      OP_2MUL: 141,
      OP_2DIV: 142,
      OP_NEGATE: 143,
      OP_ABS: 144,
      OP_NOT: 145,
      OP_0NOTEQUAL: 146,
      OP_ADD: 147,
      OP_SUB: 148,
      OP_MUL: 149,
      OP_DIV: 150,
      OP_MOD: 151,
      OP_LSHIFT: 152,
      OP_RSHIFT: 153,
      OP_BOOLAND: 154,
      OP_BOOLOR: 155,
      OP_NUMEQUAL: 156,
      OP_NUMEQUALVERIFY: 157,
      OP_NUMNOTEQUAL: 158,
      OP_LESSTHAN: 159,
      OP_GREATERTHAN: 160,
      OP_LESSTHANOREQUAL: 161,
      OP_GREATERTHANOREQUAL: 162,
      OP_MIN: 163,
      OP_MAX: 164,
      OP_WITHIN: 165,
      OP_RIPEMD160: 166,
      OP_SHA1: 167,
      OP_SHA256: 168,
      OP_HASH160: 169,
      OP_HASH256: 170,
      OP_CODESEPARATOR: 171,
      OP_CHECKSIG: 172,
      OP_CHECKSIGVERIFY: 173,
      OP_CHECKMULTISIG: 174,
      OP_CHECKMULTISIGVERIFY: 175,
      OP_NOP1: 176,
      OP_NOP2: 177,
      OP_CHECKLOCKTIMEVERIFY: 177,
      OP_NOP3: 178,
      OP_CHECKSEQUENCEVERIFY: 178,
      OP_NOP4: 179,
      OP_NOP5: 180,
      OP_NOP6: 181,
      OP_NOP7: 182,
      OP_NOP8: 183,
      OP_NOP9: 184,
      OP_NOP10: 185,
      OP_CHECKSIGADD: 186,
      OP_PUBKEYHASH: 253,
      OP_PUBKEY: 254,
      OP_INVALIDOPCODE: 255
    };
    exports.OPS = OPS;
    var REVERSE_OPS = {};
    exports.REVERSE_OPS = REVERSE_OPS;
    for (const op of Object.keys(OPS)) {
      const code = OPS[op];
      REVERSE_OPS[code] = op;
    }
  }
});

// node_modules/belcoinjs-lib/src/push_data.js
var require_push_data = __commonJS({
  "node_modules/belcoinjs-lib/src/push_data.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.decode = exports.encode = exports.encodingLength = void 0;
    var ops_1 = require_ops();
    function encodingLength(i) {
      return i < ops_1.OPS.OP_PUSHDATA1 ? 1 : i <= 255 ? 2 : i <= 65535 ? 3 : 5;
    }
    exports.encodingLength = encodingLength;
    function encode(buffer, num, offset) {
      const size = encodingLength(num);
      if (size === 1) {
        buffer.writeUInt8(num, offset);
      } else if (size === 2) {
        buffer.writeUInt8(ops_1.OPS.OP_PUSHDATA1, offset);
        buffer.writeUInt8(num, offset + 1);
      } else if (size === 3) {
        buffer.writeUInt8(ops_1.OPS.OP_PUSHDATA2, offset);
        buffer.writeUInt16LE(num, offset + 1);
      } else {
        buffer.writeUInt8(ops_1.OPS.OP_PUSHDATA4, offset);
        buffer.writeUInt32LE(num, offset + 1);
      }
      return size;
    }
    exports.encode = encode;
    function decode(buffer, offset) {
      const opcode = buffer.readUInt8(offset);
      let num;
      let size;
      if (opcode < ops_1.OPS.OP_PUSHDATA1) {
        num = opcode;
        size = 1;
      } else if (opcode === ops_1.OPS.OP_PUSHDATA1) {
        if (offset + 2 > buffer.length) return null;
        num = buffer.readUInt8(offset + 1);
        size = 2;
      } else if (opcode === ops_1.OPS.OP_PUSHDATA2) {
        if (offset + 3 > buffer.length) return null;
        num = buffer.readUInt16LE(offset + 1);
        size = 3;
      } else {
        if (offset + 5 > buffer.length) return null;
        if (opcode !== ops_1.OPS.OP_PUSHDATA4) throw new Error("Unexpected opcode");
        num = buffer.readUInt32LE(offset + 1);
        size = 5;
      }
      return {
        opcode,
        number: num,
        size
      };
    }
    exports.decode = decode;
  }
});

// node_modules/belcoinjs-lib/src/script_number.js
var require_script_number = __commonJS({
  "node_modules/belcoinjs-lib/src/script_number.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.encode = exports.decode = void 0;
    function decode(buffer, maxLength, minimal) {
      maxLength = maxLength || 4;
      minimal = minimal === void 0 ? true : minimal;
      const length = buffer.length;
      if (length === 0) return 0;
      if (length > maxLength) throw new TypeError("Script number overflow");
      if (minimal) {
        if ((buffer[length - 1] & 127) === 0) {
          if (length <= 1 || (buffer[length - 2] & 128) === 0)
            throw new Error("Non-minimally encoded script number");
        }
      }
      if (length === 5) {
        const a = buffer.readUInt32LE(0);
        const b = buffer.readUInt8(4);
        if (b & 128) return -((b & ~128) * 4294967296 + a);
        return b * 4294967296 + a;
      }
      let result = 0;
      for (let i = 0; i < length; ++i) {
        result |= buffer[i] << 8 * i;
      }
      if (buffer[length - 1] & 128)
        return -(result & ~(128 << 8 * (length - 1)));
      return result;
    }
    exports.decode = decode;
    function scriptNumSize(i) {
      return i > 2147483647 ? 5 : i > 8388607 ? 4 : i > 32767 ? 3 : i > 127 ? 2 : i > 0 ? 1 : 0;
    }
    function encode(_number) {
      let value = Math.abs(_number);
      const size = scriptNumSize(value);
      const buffer = Buffer2.allocUnsafe(size);
      const negative = _number < 0;
      for (let i = 0; i < size; ++i) {
        buffer.writeUInt8(value & 255, i);
        value >>= 8;
      }
      if (buffer[size - 1] & 128) {
        buffer.writeUInt8(negative ? 128 : 0, size - 1);
      } else if (negative) {
        buffer[size - 1] |= 128;
      }
      return buffer;
    }
    exports.encode = encode;
  }
});

// node_modules/typeforce/native.js
var require_native = __commonJS({
  "node_modules/typeforce/native.js"(exports, module) {
    init_buffer_shim();
    var types = {
      Array: function(value) {
        return value !== null && value !== void 0 && value.constructor === Array;
      },
      Boolean: function(value) {
        return typeof value === "boolean";
      },
      Function: function(value) {
        return typeof value === "function";
      },
      Nil: function(value) {
        return value === void 0 || value === null;
      },
      Number: function(value) {
        return typeof value === "number";
      },
      Object: function(value) {
        return typeof value === "object";
      },
      String: function(value) {
        return typeof value === "string";
      },
      "": function() {
        return true;
      }
    };
    types.Null = types.Nil;
    for (typeName in types) {
      types[typeName].toJSON = function(t) {
        return t;
      }.bind(null, typeName);
    }
    var typeName;
    module.exports = types;
  }
});

// node_modules/typeforce/errors.js
var require_errors = __commonJS({
  "node_modules/typeforce/errors.js"(exports, module) {
    init_buffer_shim();
    var native = require_native();
    function getTypeName(fn) {
      return fn.name || fn.toString().match(/function (.*?)\s*\(/)[1];
    }
    function getValueTypeName(value) {
      return native.Nil(value) ? "" : getTypeName(value.constructor);
    }
    function getValue(value) {
      if (native.Function(value)) return "";
      if (native.String(value)) return JSON.stringify(value);
      if (value && native.Object(value)) return "";
      return value;
    }
    function captureStackTrace(e, t) {
      if (Error.captureStackTrace) {
        Error.captureStackTrace(e, t);
      }
    }
    function tfJSON(type) {
      if (native.Function(type)) return type.toJSON ? type.toJSON() : getTypeName(type);
      if (native.Array(type)) return "Array";
      if (type && native.Object(type)) return "Object";
      return type !== void 0 ? type : "";
    }
    function tfErrorString(type, value, valueTypeName) {
      var valueJson = getValue(value);
      return "Expected " + tfJSON(type) + ", got" + (valueTypeName !== "" ? " " + valueTypeName : "") + (valueJson !== "" ? " " + valueJson : "");
    }
    function TfTypeError(type, value, valueTypeName) {
      valueTypeName = valueTypeName || getValueTypeName(value);
      this.message = tfErrorString(type, value, valueTypeName);
      captureStackTrace(this, TfTypeError);
      this.__type = type;
      this.__value = value;
      this.__valueTypeName = valueTypeName;
    }
    TfTypeError.prototype = Object.create(Error.prototype);
    TfTypeError.prototype.constructor = TfTypeError;
    function tfPropertyErrorString(type, label, name, value, valueTypeName) {
      var description = '" of type ';
      if (label === "key") description = '" with key type ';
      return tfErrorString('property "' + tfJSON(name) + description + tfJSON(type), value, valueTypeName);
    }
    function TfPropertyTypeError(type, property, label, value, valueTypeName) {
      if (type) {
        valueTypeName = valueTypeName || getValueTypeName(value);
        this.message = tfPropertyErrorString(type, label, property, value, valueTypeName);
      } else {
        this.message = 'Unexpected property "' + property + '"';
      }
      captureStackTrace(this, TfTypeError);
      this.__label = label;
      this.__property = property;
      this.__type = type;
      this.__value = value;
      this.__valueTypeName = valueTypeName;
    }
    TfPropertyTypeError.prototype = Object.create(Error.prototype);
    TfPropertyTypeError.prototype.constructor = TfTypeError;
    function tfCustomError(expected, actual) {
      return new TfTypeError(expected, {}, actual);
    }
    function tfSubError(e, property, label) {
      if (e instanceof TfPropertyTypeError) {
        property = property + "." + e.__property;
        e = new TfPropertyTypeError(
          e.__type,
          property,
          e.__label,
          e.__value,
          e.__valueTypeName
        );
      } else if (e instanceof TfTypeError) {
        e = new TfPropertyTypeError(
          e.__type,
          property,
          label,
          e.__value,
          e.__valueTypeName
        );
      }
      captureStackTrace(e);
      return e;
    }
    module.exports = {
      TfTypeError,
      TfPropertyTypeError,
      tfCustomError,
      tfSubError,
      tfJSON,
      getValueTypeName
    };
  }
});

// node_modules/typeforce/extra.js
var require_extra = __commonJS({
  "node_modules/typeforce/extra.js"(exports, module) {
    init_buffer_shim();
    var NATIVE = require_native();
    var ERRORS = require_errors();
    function _Buffer(value) {
      return Buffer2.isBuffer(value);
    }
    function Hex(value) {
      return typeof value === "string" && /^([0-9a-f]{2})+$/i.test(value);
    }
    function _LengthN(type, length) {
      var name = type.toJSON();
      function Length(value) {
        if (!type(value)) return false;
        if (value.length === length) return true;
        throw ERRORS.tfCustomError(name + "(Length: " + length + ")", name + "(Length: " + value.length + ")");
      }
      Length.toJSON = function() {
        return name;
      };
      return Length;
    }
    var _ArrayN = _LengthN.bind(null, NATIVE.Array);
    var _BufferN = _LengthN.bind(null, _Buffer);
    var _HexN = _LengthN.bind(null, Hex);
    var _StringN = _LengthN.bind(null, NATIVE.String);
    function Range(a, b, f) {
      f = f || NATIVE.Number;
      function _range(value, strict) {
        return f(value, strict) && value > a && value < b;
      }
      _range.toJSON = function() {
        return `${f.toJSON()} between [${a}, ${b}]`;
      };
      return _range;
    }
    var INT53_MAX = Math.pow(2, 53) - 1;
    function Finite(value) {
      return typeof value === "number" && isFinite(value);
    }
    function Int8(value) {
      return value << 24 >> 24 === value;
    }
    function Int16(value) {
      return value << 16 >> 16 === value;
    }
    function Int32(value) {
      return (value | 0) === value;
    }
    function Int53(value) {
      return typeof value === "number" && value >= -INT53_MAX && value <= INT53_MAX && Math.floor(value) === value;
    }
    function UInt8(value) {
      return (value & 255) === value;
    }
    function UInt16(value) {
      return (value & 65535) === value;
    }
    function UInt32(value) {
      return value >>> 0 === value;
    }
    function UInt53(value) {
      return typeof value === "number" && value >= 0 && value <= INT53_MAX && Math.floor(value) === value;
    }
    var types = {
      ArrayN: _ArrayN,
      Buffer: _Buffer,
      BufferN: _BufferN,
      Finite,
      Hex,
      HexN: _HexN,
      Int8,
      Int16,
      Int32,
      Int53,
      Range,
      StringN: _StringN,
      UInt8,
      UInt16,
      UInt32,
      UInt53
    };
    for (typeName in types) {
      types[typeName].toJSON = function(t) {
        return t;
      }.bind(null, typeName);
    }
    var typeName;
    module.exports = types;
  }
});

// node_modules/typeforce/index.js
var require_typeforce = __commonJS({
  "node_modules/typeforce/index.js"(exports, module) {
    init_buffer_shim();
    var ERRORS = require_errors();
    var NATIVE = require_native();
    var tfJSON = ERRORS.tfJSON;
    var TfTypeError = ERRORS.TfTypeError;
    var TfPropertyTypeError = ERRORS.TfPropertyTypeError;
    var tfSubError = ERRORS.tfSubError;
    var getValueTypeName = ERRORS.getValueTypeName;
    var TYPES = {
      arrayOf: function arrayOf(type, options) {
        type = compile(type);
        options = options || {};
        function _arrayOf(array, strict) {
          if (!NATIVE.Array(array)) return false;
          if (NATIVE.Nil(array)) return false;
          if (options.minLength !== void 0 && array.length < options.minLength) return false;
          if (options.maxLength !== void 0 && array.length > options.maxLength) return false;
          if (options.length !== void 0 && array.length !== options.length) return false;
          return array.every(function(value, i) {
            try {
              return typeforce(type, value, strict);
            } catch (e) {
              throw tfSubError(e, i);
            }
          });
        }
        _arrayOf.toJSON = function() {
          var str = "[" + tfJSON(type) + "]";
          if (options.length !== void 0) {
            str += "{" + options.length + "}";
          } else if (options.minLength !== void 0 || options.maxLength !== void 0) {
            str += "{" + (options.minLength === void 0 ? 0 : options.minLength) + "," + (options.maxLength === void 0 ? Infinity : options.maxLength) + "}";
          }
          return str;
        };
        return _arrayOf;
      },
      maybe: function maybe(type) {
        type = compile(type);
        function _maybe(value, strict) {
          return NATIVE.Nil(value) || type(value, strict, maybe);
        }
        _maybe.toJSON = function() {
          return "?" + tfJSON(type);
        };
        return _maybe;
      },
      map: function map(propertyType, propertyKeyType) {
        propertyType = compile(propertyType);
        if (propertyKeyType) propertyKeyType = compile(propertyKeyType);
        function _map(value, strict) {
          if (!NATIVE.Object(value)) return false;
          if (NATIVE.Nil(value)) return false;
          for (var propertyName in value) {
            try {
              if (propertyKeyType) {
                typeforce(propertyKeyType, propertyName, strict);
              }
            } catch (e) {
              throw tfSubError(e, propertyName, "key");
            }
            try {
              var propertyValue = value[propertyName];
              typeforce(propertyType, propertyValue, strict);
            } catch (e) {
              throw tfSubError(e, propertyName);
            }
          }
          return true;
        }
        if (propertyKeyType) {
          _map.toJSON = function() {
            return "{" + tfJSON(propertyKeyType) + ": " + tfJSON(propertyType) + "}";
          };
        } else {
          _map.toJSON = function() {
            return "{" + tfJSON(propertyType) + "}";
          };
        }
        return _map;
      },
      object: function object(uncompiled) {
        var type = {};
        for (var typePropertyName in uncompiled) {
          type[typePropertyName] = compile(uncompiled[typePropertyName]);
        }
        function _object(value, strict) {
          if (!NATIVE.Object(value)) return false;
          if (NATIVE.Nil(value)) return false;
          var propertyName;
          try {
            for (propertyName in type) {
              var propertyType = type[propertyName];
              var propertyValue = value[propertyName];
              typeforce(propertyType, propertyValue, strict);
            }
          } catch (e) {
            throw tfSubError(e, propertyName);
          }
          if (strict) {
            for (propertyName in value) {
              if (type[propertyName]) continue;
              throw new TfPropertyTypeError(void 0, propertyName);
            }
          }
          return true;
        }
        _object.toJSON = function() {
          return tfJSON(type);
        };
        return _object;
      },
      anyOf: function anyOf() {
        var types = [].slice.call(arguments).map(compile);
        function _anyOf(value, strict) {
          return types.some(function(type) {
            try {
              return typeforce(type, value, strict);
            } catch (e) {
              return false;
            }
          });
        }
        _anyOf.toJSON = function() {
          return types.map(tfJSON).join("|");
        };
        return _anyOf;
      },
      allOf: function allOf() {
        var types = [].slice.call(arguments).map(compile);
        function _allOf(value, strict) {
          return types.every(function(type) {
            try {
              return typeforce(type, value, strict);
            } catch (e) {
              return false;
            }
          });
        }
        _allOf.toJSON = function() {
          return types.map(tfJSON).join(" & ");
        };
        return _allOf;
      },
      quacksLike: function quacksLike(type) {
        function _quacksLike(value) {
          return type === getValueTypeName(value);
        }
        _quacksLike.toJSON = function() {
          return type;
        };
        return _quacksLike;
      },
      tuple: function tuple() {
        var types = [].slice.call(arguments).map(compile);
        function _tuple(values, strict) {
          if (NATIVE.Nil(values)) return false;
          if (NATIVE.Nil(values.length)) return false;
          if (strict && values.length !== types.length) return false;
          return types.every(function(type, i) {
            try {
              return typeforce(type, values[i], strict);
            } catch (e) {
              throw tfSubError(e, i);
            }
          });
        }
        _tuple.toJSON = function() {
          return "(" + types.map(tfJSON).join(", ") + ")";
        };
        return _tuple;
      },
      value: function value(expected) {
        function _value(actual) {
          return actual === expected;
        }
        _value.toJSON = function() {
          return expected;
        };
        return _value;
      }
    };
    TYPES.oneOf = TYPES.anyOf;
    function compile(type) {
      if (NATIVE.String(type)) {
        if (type[0] === "?") return TYPES.maybe(type.slice(1));
        return NATIVE[type] || TYPES.quacksLike(type);
      } else if (type && NATIVE.Object(type)) {
        if (NATIVE.Array(type)) {
          if (type.length !== 1) throw new TypeError("Expected compile() parameter of type Array of length 1");
          return TYPES.arrayOf(type[0]);
        }
        return TYPES.object(type);
      } else if (NATIVE.Function(type)) {
        return type;
      }
      return TYPES.value(type);
    }
    function typeforce(type, value, strict, surrogate) {
      if (NATIVE.Function(type)) {
        if (type(value, strict)) return true;
        throw new TfTypeError(surrogate || type, value);
      }
      return typeforce(compile(type), value, strict);
    }
    for (typeName in NATIVE) {
      typeforce[typeName] = NATIVE[typeName];
    }
    var typeName;
    for (typeName in TYPES) {
      typeforce[typeName] = TYPES[typeName];
    }
    var EXTRA = require_extra();
    for (typeName in EXTRA) {
      typeforce[typeName] = EXTRA[typeName];
    }
    typeforce.compile = compile;
    typeforce.TfTypeError = TfTypeError;
    typeforce.TfPropertyTypeError = TfPropertyTypeError;
    module.exports = typeforce;
  }
});

// node_modules/belcoinjs-lib/src/types.js
var require_types = __commonJS({
  "node_modules/belcoinjs-lib/src/types.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.oneOf = exports.Null = exports.BufferN = exports.Function = exports.UInt32 = exports.UInt8 = exports.tuple = exports.maybe = exports.Hex = exports.Buffer = exports.String = exports.Boolean = exports.Array = exports.Number = exports.Hash256bit = exports.Hash160bit = exports.Buffer256bit = exports.isTaptree = exports.isTapleaf = exports.TAPLEAF_VERSION_MASK = exports.Satoshi = exports.isPoint = exports.stacksEqual = exports.typeforce = void 0;
    var buffer_1 = require_buffer();
    exports.typeforce = require_typeforce();
    var ZERO32 = buffer_1.Buffer.alloc(32, 0);
    var EC_P = buffer_1.Buffer.from(
      "fffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
      "hex"
    );
    function stacksEqual(a, b) {
      if (a.length !== b.length) return false;
      return a.every((x, i) => {
        return x.equals(b[i]);
      });
    }
    exports.stacksEqual = stacksEqual;
    function isPoint(p) {
      if (!buffer_1.Buffer.isBuffer(p)) return false;
      if (p.length < 33) return false;
      const t = p[0];
      const x = p.slice(1, 33);
      if (x.compare(ZERO32) === 0) return false;
      if (x.compare(EC_P) >= 0) return false;
      if ((t === 2 || t === 3) && p.length === 33) {
        return true;
      }
      const y = p.slice(33);
      if (y.compare(ZERO32) === 0) return false;
      if (y.compare(EC_P) >= 0) return false;
      if (t === 4 && p.length === 65) return true;
      return false;
    }
    exports.isPoint = isPoint;
    var SATOSHI_MAX = 21 * 1e14;
    function Satoshi(value) {
      return exports.typeforce.UInt53(value) && value <= SATOSHI_MAX;
    }
    exports.Satoshi = Satoshi;
    exports.TAPLEAF_VERSION_MASK = 254;
    function isTapleaf(o) {
      if (!o || !("output" in o)) return false;
      if (!buffer_1.Buffer.isBuffer(o.output)) return false;
      if (o.version !== void 0)
        return (o.version & exports.TAPLEAF_VERSION_MASK) === o.version;
      return true;
    }
    exports.isTapleaf = isTapleaf;
    function isTaptree(scriptTree) {
      if (!(0, exports.Array)(scriptTree)) return isTapleaf(scriptTree);
      if (scriptTree.length !== 2) return false;
      return scriptTree.every((t) => isTaptree(t));
    }
    exports.isTaptree = isTaptree;
    exports.Buffer256bit = exports.typeforce.BufferN(32);
    exports.Hash160bit = exports.typeforce.BufferN(20);
    exports.Hash256bit = exports.typeforce.BufferN(32);
    exports.Number = exports.typeforce.Number;
    exports.Array = exports.typeforce.Array;
    exports.Boolean = exports.typeforce.Boolean;
    exports.String = exports.typeforce.String;
    exports.Buffer = exports.typeforce.Buffer;
    exports.Hex = exports.typeforce.Hex;
    exports.maybe = exports.typeforce.maybe;
    exports.tuple = exports.typeforce.tuple;
    exports.UInt8 = exports.typeforce.UInt8;
    exports.UInt32 = exports.typeforce.UInt32;
    exports.Function = exports.typeforce.Function;
    exports.BufferN = exports.typeforce.BufferN;
    exports.Null = exports.typeforce.Null;
    exports.oneOf = exports.typeforce.oneOf;
  }
});

// node_modules/belcoinjs-lib/src/script_signature.js
var require_script_signature = __commonJS({
  "node_modules/belcoinjs-lib/src/script_signature.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.encode = exports.decode = void 0;
    var bip66 = require_bip66();
    var script_1 = require_script();
    var types = require_types();
    var { typeforce } = types;
    var ZERO = Buffer2.alloc(1, 0);
    function toDER(x) {
      let i = 0;
      while (x[i] === 0) ++i;
      if (i === x.length) return ZERO;
      x = x.slice(i);
      if (x[0] & 128) return Buffer2.concat([ZERO, x], 1 + x.length);
      return x;
    }
    function fromDER(x) {
      if (x[0] === 0) x = x.slice(1);
      const buffer = Buffer2.alloc(32, 0);
      const bstart = Math.max(0, 32 - x.length);
      x.copy(buffer, bstart);
      return buffer;
    }
    function decode(buffer) {
      const hashType = buffer.readUInt8(buffer.length - 1);
      if (!(0, script_1.isDefinedHashType)(hashType)) {
        throw new Error("Invalid hashType " + hashType);
      }
      const decoded = bip66.decode(buffer.slice(0, -1));
      const r = fromDER(decoded.r);
      const s = fromDER(decoded.s);
      const signature = Buffer2.concat([r, s], 64);
      return { signature, hashType };
    }
    exports.decode = decode;
    function encode(signature, hashType) {
      typeforce(
        {
          signature: types.BufferN(64),
          hashType: types.UInt8
        },
        { signature, hashType }
      );
      if (!(0, script_1.isDefinedHashType)(hashType)) {
        throw new Error("Invalid hashType " + hashType);
      }
      const hashTypeBuffer = Buffer2.allocUnsafe(1);
      hashTypeBuffer.writeUInt8(hashType, 0);
      const r = toDER(signature.slice(0, 32));
      const s = toDER(signature.slice(32, 64));
      return Buffer2.concat([bip66.encode(r, s), hashTypeBuffer]);
    }
    exports.encode = encode;
  }
});

// node_modules/belcoinjs-lib/src/script.js
var require_script = __commonJS({
  "node_modules/belcoinjs-lib/src/script.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.signature = exports.number = exports.isCanonicalScriptSignature = exports.isDefinedHashType = exports.isCanonicalPubKey = exports.toStack = exports.fromASM = exports.toASM = exports.decompile = exports.compile = exports.countNonPushOnlyOPs = exports.isPushOnly = exports.OPS = void 0;
    var bip66 = require_bip66();
    var ops_1 = require_ops();
    Object.defineProperty(exports, "OPS", {
      enumerable: true,
      get: function() {
        return ops_1.OPS;
      }
    });
    var pushdata = require_push_data();
    var scriptNumber = require_script_number();
    var scriptSignature = require_script_signature();
    var types = require_types();
    var { typeforce } = types;
    var OP_INT_BASE = ops_1.OPS.OP_RESERVED;
    function isOPInt(value) {
      return types.Number(value) && (value === ops_1.OPS.OP_0 || value >= ops_1.OPS.OP_1 && value <= ops_1.OPS.OP_16 || value === ops_1.OPS.OP_1NEGATE);
    }
    function isPushOnlyChunk(value) {
      return types.Buffer(value) || isOPInt(value);
    }
    function isPushOnly(value) {
      return types.Array(value) && value.every(isPushOnlyChunk);
    }
    exports.isPushOnly = isPushOnly;
    function countNonPushOnlyOPs(value) {
      return value.length - value.filter(isPushOnlyChunk).length;
    }
    exports.countNonPushOnlyOPs = countNonPushOnlyOPs;
    function asMinimalOP(buffer) {
      if (buffer.length === 0) return ops_1.OPS.OP_0;
      if (buffer.length !== 1) return;
      if (buffer[0] >= 1 && buffer[0] <= 16) return OP_INT_BASE + buffer[0];
      if (buffer[0] === 129) return ops_1.OPS.OP_1NEGATE;
    }
    function chunksIsBuffer(buf) {
      return Buffer2.isBuffer(buf);
    }
    function chunksIsArray(buf) {
      return types.Array(buf);
    }
    function singleChunkIsBuffer(buf) {
      return Buffer2.isBuffer(buf);
    }
    function compile(chunks) {
      if (chunksIsBuffer(chunks)) return chunks;
      typeforce(types.Array, chunks);
      const bufferSize = chunks.reduce((accum, chunk) => {
        if (singleChunkIsBuffer(chunk)) {
          if (chunk.length === 1 && asMinimalOP(chunk) !== void 0) {
            return accum + 1;
          }
          return accum + pushdata.encodingLength(chunk.length) + chunk.length;
        }
        return accum + 1;
      }, 0);
      const buffer = Buffer2.allocUnsafe(bufferSize);
      let offset = 0;
      chunks.forEach((chunk) => {
        if (singleChunkIsBuffer(chunk)) {
          const opcode = asMinimalOP(chunk);
          if (opcode !== void 0) {
            buffer.writeUInt8(opcode, offset);
            offset += 1;
            return;
          }
          offset += pushdata.encode(buffer, chunk.length, offset);
          chunk.copy(buffer, offset);
          offset += chunk.length;
        } else {
          buffer.writeUInt8(chunk, offset);
          offset += 1;
        }
      });
      if (offset !== buffer.length) throw new Error("Could not decode chunks");
      return buffer;
    }
    exports.compile = compile;
    function decompile(buffer) {
      if (chunksIsArray(buffer)) return buffer;
      typeforce(types.Buffer, buffer);
      const chunks = [];
      let i = 0;
      while (i < buffer.length) {
        const opcode = buffer[i];
        if (opcode > ops_1.OPS.OP_0 && opcode <= ops_1.OPS.OP_PUSHDATA4) {
          const d = pushdata.decode(buffer, i);
          if (d === null) return null;
          i += d.size;
          if (i + d.number > buffer.length) return null;
          const data = buffer.slice(i, i + d.number);
          i += d.number;
          const op = asMinimalOP(data);
          if (op !== void 0) {
            chunks.push(op);
          } else {
            chunks.push(data);
          }
        } else {
          chunks.push(opcode);
          i += 1;
        }
      }
      return chunks;
    }
    exports.decompile = decompile;
    function toASM(chunks) {
      if (chunksIsBuffer(chunks)) {
        chunks = decompile(chunks);
      }
      if (!chunks) {
        throw new Error("Could not convert invalid chunks to ASM");
      }
      return chunks.map((chunk) => {
        if (singleChunkIsBuffer(chunk)) {
          const op = asMinimalOP(chunk);
          if (op === void 0) return chunk.toString("hex");
          chunk = op;
        }
        return ops_1.REVERSE_OPS[chunk];
      }).join(" ");
    }
    exports.toASM = toASM;
    function fromASM(asm) {
      typeforce(types.String, asm);
      return compile(
        asm.split(" ").map((chunkStr) => {
          if (ops_1.OPS[chunkStr] !== void 0) return ops_1.OPS[chunkStr];
          typeforce(types.Hex, chunkStr);
          return Buffer2.from(chunkStr, "hex");
        })
      );
    }
    exports.fromASM = fromASM;
    function toStack(chunks) {
      chunks = decompile(chunks);
      typeforce(isPushOnly, chunks);
      return chunks.map((op) => {
        if (singleChunkIsBuffer(op)) return op;
        if (op === ops_1.OPS.OP_0) return Buffer2.allocUnsafe(0);
        return scriptNumber.encode(op - OP_INT_BASE);
      });
    }
    exports.toStack = toStack;
    function isCanonicalPubKey(buffer) {
      return types.isPoint(buffer);
    }
    exports.isCanonicalPubKey = isCanonicalPubKey;
    function isDefinedHashType(hashType) {
      const hashTypeMod = hashType & ~128;
      return hashTypeMod > 0 && hashTypeMod < 4;
    }
    exports.isDefinedHashType = isDefinedHashType;
    function isCanonicalScriptSignature(buffer) {
      if (!Buffer2.isBuffer(buffer)) return false;
      if (!isDefinedHashType(buffer[buffer.length - 1])) return false;
      return bip66.check(buffer.slice(0, -1));
    }
    exports.isCanonicalScriptSignature = isCanonicalScriptSignature;
    exports.number = scriptNumber;
    exports.signature = scriptSignature;
  }
});

// node_modules/belcoinjs-lib/src/payments/lazy.js
var require_lazy = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/lazy.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.value = exports.prop = void 0;
    function prop(object, name, f) {
      Object.defineProperty(object, name, {
        configurable: true,
        enumerable: true,
        get() {
          const _value = f.call(this);
          this[name] = _value;
          return _value;
        },
        set(_value) {
          Object.defineProperty(this, name, {
            configurable: true,
            enumerable: true,
            value: _value,
            writable: true
          });
        }
      });
    }
    exports.prop = prop;
    function value(f) {
      let _value;
      return () => {
        if (_value !== void 0) return _value;
        _value = f();
        return _value;
      };
    }
    exports.value = value;
  }
});

// node_modules/belcoinjs-lib/src/payments/embed.js
var require_embed = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/embed.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2data = void 0;
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var OPS = bscript2.OPS;
    function p2data(a, opts) {
      if (!a.data && !a.output) throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
          data: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
          )
        },
        a
      );
      const network = a.network || networks_1.bellcoin;
      const o = { name: "embed", network };
      lazy.prop(o, "output", () => {
        if (!a.data) return;
        return bscript2.compile([OPS.OP_RETURN].concat(a.data));
      });
      lazy.prop(o, "data", () => {
        if (!a.output) return;
        return bscript2.decompile(a.output).slice(1);
      });
      if (opts.validate) {
        if (a.output) {
          const chunks = bscript2.decompile(a.output);
          if (chunks[0] !== OPS.OP_RETURN) throw new TypeError("Output is invalid");
          if (!chunks.slice(1).every(types_1.typeforce.Buffer))
            throw new TypeError("Output is invalid");
          if (a.data && !(0, types_1.stacksEqual)(a.data, o.data))
            throw new TypeError("Data mismatch");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2data = p2data;
  }
});

// node_modules/belcoinjs-lib/src/payments/p2ms.js
var require_p2ms = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2ms.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2ms = void 0;
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var OPS = bscript2.OPS;
    var OP_INT_BASE = OPS.OP_RESERVED;
    function p2ms(a, opts) {
      if (!a.input && !a.output && !(a.pubkeys && a.m !== void 0) && !a.signatures)
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      function isAcceptableSignature(x) {
        return bscript2.isCanonicalScriptSignature(x) || (opts.allowIncomplete && x === OPS.OP_0) !== void 0;
      }
      (0, types_1.typeforce)(
        {
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          m: types_1.typeforce.maybe(types_1.typeforce.Number),
          n: types_1.typeforce.maybe(types_1.typeforce.Number),
          output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
          pubkeys: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(types_1.isPoint)
          ),
          signatures: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(isAcceptableSignature)
          ),
          input: types_1.typeforce.maybe(types_1.typeforce.Buffer)
        },
        a
      );
      const network = a.network || networks_1.bellcoin;
      const o = { network };
      let chunks = [];
      let decoded = false;
      function decode(output) {
        if (decoded) return;
        decoded = true;
        chunks = bscript2.decompile(output);
        o.m = chunks[0] - OP_INT_BASE;
        o.n = chunks[chunks.length - 2] - OP_INT_BASE;
        o.pubkeys = chunks.slice(1, -2);
      }
      lazy.prop(o, "output", () => {
        if (!a.m) return;
        if (!o.n) return;
        if (!a.pubkeys) return;
        return bscript2.compile(
          [].concat(
            OP_INT_BASE + a.m,
            a.pubkeys,
            OP_INT_BASE + o.n,
            OPS.OP_CHECKMULTISIG
          )
        );
      });
      lazy.prop(o, "m", () => {
        if (!o.output) return;
        decode(o.output);
        return o.m;
      });
      lazy.prop(o, "n", () => {
        if (!o.pubkeys) return;
        return o.pubkeys.length;
      });
      lazy.prop(o, "pubkeys", () => {
        if (!a.output) return;
        decode(a.output);
        return o.pubkeys;
      });
      lazy.prop(o, "signatures", () => {
        if (!a.input) return;
        return bscript2.decompile(a.input).slice(1);
      });
      lazy.prop(o, "input", () => {
        if (!a.signatures) return;
        return bscript2.compile([OPS.OP_0].concat(a.signatures));
      });
      lazy.prop(o, "witness", () => {
        if (!o.input) return;
        return [];
      });
      lazy.prop(o, "name", () => {
        if (!o.m || !o.n) return;
        return `p2ms(${o.m} of ${o.n})`;
      });
      if (opts.validate) {
        if (a.output) {
          decode(a.output);
          if (!types_1.typeforce.Number(chunks[0]))
            throw new TypeError("Output is invalid");
          if (!types_1.typeforce.Number(chunks[chunks.length - 2]))
            throw new TypeError("Output is invalid");
          if (chunks[chunks.length - 1] !== OPS.OP_CHECKMULTISIG)
            throw new TypeError("Output is invalid");
          if (o.m <= 0 || o.n > 16 || o.m > o.n || o.n !== chunks.length - 3)
            throw new TypeError("Output is invalid");
          if (!o.pubkeys.every((x) => (0, types_1.isPoint)(x)))
            throw new TypeError("Output is invalid");
          if (a.m !== void 0 && a.m !== o.m) throw new TypeError("m mismatch");
          if (a.n !== void 0 && a.n !== o.n) throw new TypeError("n mismatch");
          if (a.pubkeys && !(0, types_1.stacksEqual)(a.pubkeys, o.pubkeys))
            throw new TypeError("Pubkeys mismatch");
        }
        if (a.pubkeys) {
          if (a.n !== void 0 && a.n !== a.pubkeys.length)
            throw new TypeError("Pubkey count mismatch");
          o.n = a.pubkeys.length;
          if (o.n < o.m) throw new TypeError("Pubkey count cannot be less than m");
        }
        if (a.signatures) {
          if (a.signatures.length < o.m)
            throw new TypeError("Not enough signatures provided");
          if (a.signatures.length > o.m)
            throw new TypeError("Too many signatures provided");
        }
        if (a.input) {
          if (a.input[0] !== OPS.OP_0) throw new TypeError("Input is invalid");
          if (o.signatures.length === 0 || !o.signatures.every(isAcceptableSignature))
            throw new TypeError("Input has invalid signature(s)");
          if (a.signatures && !(0, types_1.stacksEqual)(a.signatures, o.signatures))
            throw new TypeError("Signature mismatch");
          if (a.m !== void 0 && a.m !== a.signatures.length)
            throw new TypeError("Signature count mismatch");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2ms = p2ms;
  }
});

// node_modules/belcoinjs-lib/src/payments/p2pk.js
var require_p2pk = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2pk.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2pk = void 0;
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var OPS = bscript2.OPS;
    function p2pk(a, opts) {
      if (!a.input && !a.output && !a.pubkey && !a.input && !a.signature)
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
          pubkey: types_1.typeforce.maybe(types_1.isPoint),
          signature: types_1.typeforce.maybe(bscript2.isCanonicalScriptSignature),
          input: types_1.typeforce.maybe(types_1.typeforce.Buffer)
        },
        a
      );
      const _chunks = lazy.value(() => {
        return bscript2.decompile(a.input);
      });
      const network = a.network || networks_1.bellcoin;
      const o = { name: "p2pk", network };
      lazy.prop(o, "output", () => {
        if (!a.pubkey) return;
        return bscript2.compile([a.pubkey, OPS.OP_CHECKSIG]);
      });
      lazy.prop(o, "pubkey", () => {
        if (!a.output) return;
        return a.output.slice(1, -1);
      });
      lazy.prop(o, "signature", () => {
        if (!a.input) return;
        return _chunks()[0];
      });
      lazy.prop(o, "input", () => {
        if (!a.signature) return;
        return bscript2.compile([a.signature]);
      });
      lazy.prop(o, "witness", () => {
        if (!o.input) return;
        return [];
      });
      if (opts.validate) {
        if (a.output) {
          if (a.output[a.output.length - 1] !== OPS.OP_CHECKSIG)
            throw new TypeError("Output is invalid");
          if (!(0, types_1.isPoint)(o.pubkey))
            throw new TypeError("Output pubkey is invalid");
          if (a.pubkey && !a.pubkey.equals(o.pubkey))
            throw new TypeError("Pubkey mismatch");
        }
        if (a.signature) {
          if (a.input && !a.input.equals(o.input))
            throw new TypeError("Signature mismatch");
        }
        if (a.input) {
          if (_chunks().length !== 1) throw new TypeError("Input is invalid");
          if (!bscript2.isCanonicalScriptSignature(o.signature))
            throw new TypeError("Input has invalid signature");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2pk = p2pk;
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/_assert.js
var require_assert = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/_assert.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.output = exports.exists = exports.hash = exports.bytes = exports.bool = exports.number = void 0;
    function number(n) {
      if (!Number.isSafeInteger(n) || n < 0)
        throw new Error(`Wrong positive integer: ${n}`);
    }
    exports.number = number;
    function bool(b) {
      if (typeof b !== "boolean")
        throw new Error(`Expected boolean, not ${b}`);
    }
    exports.bool = bool;
    function isBytes(a) {
      return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
    }
    function bytes(b, ...lengths) {
      if (!isBytes(b))
        throw new Error("Expected Uint8Array");
      if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
    }
    exports.bytes = bytes;
    function hash(hash2) {
      if (typeof hash2 !== "function" || typeof hash2.create !== "function")
        throw new Error("Hash should be wrapped by utils.wrapConstructor");
      number(hash2.outputLen);
      number(hash2.blockLen);
    }
    exports.hash = hash;
    function exists(instance, checkFinished = true) {
      if (instance.destroyed)
        throw new Error("Hash instance has been destroyed");
      if (checkFinished && instance.finished)
        throw new Error("Hash#digest() has already been called");
    }
    exports.exists = exists;
    function output(out, instance) {
      bytes(out);
      const min = instance.outputLen;
      if (out.length < min) {
        throw new Error(`digestInto() expects output buffer of length at least ${min}`);
      }
    }
    exports.output = output;
    var assert = { number, bool, bytes, hash, exists, output };
    exports.default = assert;
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/crypto.js
var require_crypto = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/crypto.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.crypto = void 0;
    exports.crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/utils.js
var require_utils = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/utils.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.randomBytes = exports.wrapXOFConstructorWithOpts = exports.wrapConstructorWithOpts = exports.wrapConstructor = exports.checkOpts = exports.Hash = exports.concatBytes = exports.toBytes = exports.utf8ToBytes = exports.asyncLoop = exports.nextTick = exports.hexToBytes = exports.bytesToHex = exports.isLE = exports.rotr = exports.createView = exports.u32 = exports.u8 = void 0;
    var crypto_1 = require_crypto();
    var u8 = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    exports.u8 = u8;
    var u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
    exports.u32 = u32;
    function isBytes(a) {
      return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
    }
    var createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    exports.createView = createView;
    var rotr = (word, shift) => word << 32 - shift | word >>> shift;
    exports.rotr = rotr;
    exports.isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
    if (!exports.isLE)
      throw new Error("Non little-endian hardware is not supported");
    var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    function bytesToHex(bytes) {
      if (!isBytes(bytes))
        throw new Error("Uint8Array expected");
      let hex = "";
      for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
      }
      return hex;
    }
    exports.bytesToHex = bytesToHex;
    var asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
    function asciiToBase16(char) {
      if (char >= asciis._0 && char <= asciis._9)
        return char - asciis._0;
      if (char >= asciis._A && char <= asciis._F)
        return char - (asciis._A - 10);
      if (char >= asciis._a && char <= asciis._f)
        return char - (asciis._a - 10);
      return;
    }
    function hexToBytes(hex) {
      if (typeof hex !== "string")
        throw new Error("hex string expected, got " + typeof hex);
      const hl = hex.length;
      const al = hl / 2;
      if (hl % 2)
        throw new Error("padded hex string expected, got unpadded hex of length " + hl);
      const array = new Uint8Array(al);
      for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === void 0 || n2 === void 0) {
          const char = hex[hi] + hex[hi + 1];
          throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2;
      }
      return array;
    }
    exports.hexToBytes = hexToBytes;
    var nextTick = async () => {
    };
    exports.nextTick = nextTick;
    async function asyncLoop(iters, tick, cb) {
      let ts = Date.now();
      for (let i = 0; i < iters; i++) {
        cb(i);
        const diff = Date.now() - ts;
        if (diff >= 0 && diff < tick)
          continue;
        await (0, exports.nextTick)();
        ts += diff;
      }
    }
    exports.asyncLoop = asyncLoop;
    function utf8ToBytes(str) {
      if (typeof str !== "string")
        throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
      return new Uint8Array(new TextEncoder().encode(str));
    }
    exports.utf8ToBytes = utf8ToBytes;
    function toBytes(data) {
      if (typeof data === "string")
        data = utf8ToBytes(data);
      if (!isBytes(data))
        throw new Error(`expected Uint8Array, got ${typeof data}`);
      return data;
    }
    exports.toBytes = toBytes;
    function concatBytes(...arrays) {
      let sum = 0;
      for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        if (!isBytes(a))
          throw new Error("Uint8Array expected");
        sum += a.length;
      }
      const res = new Uint8Array(sum);
      for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
      }
      return res;
    }
    exports.concatBytes = concatBytes;
    var Hash = class {
      // Safe version that clones internal state
      clone() {
        return this._cloneInto();
      }
    };
    exports.Hash = Hash;
    var toStr = {}.toString;
    function checkOpts(defaults, opts) {
      if (opts !== void 0 && toStr.call(opts) !== "[object Object]")
        throw new Error("Options should be object or undefined");
      const merged = Object.assign(defaults, opts);
      return merged;
    }
    exports.checkOpts = checkOpts;
    function wrapConstructor(hashCons) {
      const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
      const tmp = hashCons();
      hashC.outputLen = tmp.outputLen;
      hashC.blockLen = tmp.blockLen;
      hashC.create = () => hashCons();
      return hashC;
    }
    exports.wrapConstructor = wrapConstructor;
    function wrapConstructorWithOpts(hashCons) {
      const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
      const tmp = hashCons({});
      hashC.outputLen = tmp.outputLen;
      hashC.blockLen = tmp.blockLen;
      hashC.create = (opts) => hashCons(opts);
      return hashC;
    }
    exports.wrapConstructorWithOpts = wrapConstructorWithOpts;
    function wrapXOFConstructorWithOpts(hashCons) {
      const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
      const tmp = hashCons({});
      hashC.outputLen = tmp.outputLen;
      hashC.blockLen = tmp.blockLen;
      hashC.create = (opts) => hashCons(opts);
      return hashC;
    }
    exports.wrapXOFConstructorWithOpts = wrapXOFConstructorWithOpts;
    function randomBytes(bytesLength = 32) {
      if (crypto_1.crypto && typeof crypto_1.crypto.getRandomValues === "function") {
        return crypto_1.crypto.getRandomValues(new Uint8Array(bytesLength));
      }
      throw new Error("crypto.getRandomValues must be defined");
    }
    exports.randomBytes = randomBytes;
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/_sha2.js
var require_sha2 = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/_sha2.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SHA2 = void 0;
    var _assert_js_1 = require_assert();
    var utils_js_1 = require_utils();
    function setBigUint64(view, byteOffset, value, isLE) {
      if (typeof view.setBigUint64 === "function")
        return view.setBigUint64(byteOffset, value, isLE);
      const _32n = BigInt(32);
      const _u32_max = BigInt(4294967295);
      const wh = Number(value >> _32n & _u32_max);
      const wl = Number(value & _u32_max);
      const h = isLE ? 4 : 0;
      const l = isLE ? 0 : 4;
      view.setUint32(byteOffset + h, wh, isLE);
      view.setUint32(byteOffset + l, wl, isLE);
    }
    var SHA2 = class extends utils_js_1.Hash {
      constructor(blockLen, outputLen, padOffset, isLE) {
        super();
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.buffer = new Uint8Array(blockLen);
        this.view = (0, utils_js_1.createView)(this.buffer);
      }
      update(data) {
        (0, _assert_js_1.exists)(this);
        const { view, buffer, blockLen } = this;
        data = (0, utils_js_1.toBytes)(data);
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = (0, utils_js_1.createView)(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        (0, _assert_js_1.exists)(this);
        (0, _assert_js_1.output)(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        this.buffer.subarray(pos).fill(0);
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = (0, utils_js_1.createView)(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen should be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
          throw new Error("_sha2: outputLen bigger than state");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.length = length;
        to.pos = pos;
        to.finished = finished;
        to.destroyed = destroyed;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
    };
    exports.SHA2 = SHA2;
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/ripemd160.js
var require_ripemd160 = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/ripemd160.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ripemd160 = exports.RIPEMD160 = void 0;
    var _sha2_js_1 = require_sha2();
    var utils_js_1 = require_utils();
    var Rho = /* @__PURE__ */ new Uint8Array([7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8]);
    var Id = /* @__PURE__ */ Uint8Array.from({ length: 16 }, (_, i) => i);
    var Pi = /* @__PURE__ */ Id.map((i) => (9 * i + 5) % 16);
    var idxL = [Id];
    var idxR = [Pi];
    for (let i = 0; i < 4; i++)
      for (let j of [idxL, idxR])
        j.push(j[i].map((k) => Rho[k]));
    var shifts = /* @__PURE__ */ [
      [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8],
      [12, 13, 11, 15, 6, 9, 9, 7, 12, 15, 11, 13, 7, 8, 7, 7],
      [13, 15, 14, 11, 7, 7, 6, 8, 13, 14, 13, 12, 5, 5, 6, 9],
      [14, 11, 12, 14, 8, 6, 5, 5, 15, 12, 15, 14, 9, 9, 8, 6],
      [15, 12, 13, 13, 9, 5, 8, 6, 14, 11, 12, 11, 8, 6, 5, 5]
    ].map((i) => new Uint8Array(i));
    var shiftsL = /* @__PURE__ */ idxL.map((idx, i) => idx.map((j) => shifts[i][j]));
    var shiftsR = /* @__PURE__ */ idxR.map((idx, i) => idx.map((j) => shifts[i][j]));
    var Kl = /* @__PURE__ */ new Uint32Array([
      0,
      1518500249,
      1859775393,
      2400959708,
      2840853838
    ]);
    var Kr = /* @__PURE__ */ new Uint32Array([
      1352829926,
      1548603684,
      1836072691,
      2053994217,
      0
    ]);
    var rotl = (word, shift) => word << shift | word >>> 32 - shift;
    function f(group, x, y, z) {
      if (group === 0)
        return x ^ y ^ z;
      else if (group === 1)
        return x & y | ~x & z;
      else if (group === 2)
        return (x | ~y) ^ z;
      else if (group === 3)
        return x & z | y & ~z;
      else
        return x ^ (y | ~z);
    }
    var BUF = /* @__PURE__ */ new Uint32Array(16);
    var RIPEMD160 = class extends _sha2_js_1.SHA2 {
      constructor() {
        super(64, 20, 8, true);
        this.h0 = 1732584193 | 0;
        this.h1 = 4023233417 | 0;
        this.h2 = 2562383102 | 0;
        this.h3 = 271733878 | 0;
        this.h4 = 3285377520 | 0;
      }
      get() {
        const { h0, h1, h2, h3, h4 } = this;
        return [h0, h1, h2, h3, h4];
      }
      set(h0, h1, h2, h3, h4) {
        this.h0 = h0 | 0;
        this.h1 = h1 | 0;
        this.h2 = h2 | 0;
        this.h3 = h3 | 0;
        this.h4 = h4 | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          BUF[i] = view.getUint32(offset, true);
        let al = this.h0 | 0, ar = al, bl = this.h1 | 0, br = bl, cl = this.h2 | 0, cr = cl, dl = this.h3 | 0, dr = dl, el = this.h4 | 0, er = el;
        for (let group = 0; group < 5; group++) {
          const rGroup = 4 - group;
          const hbl = Kl[group], hbr = Kr[group];
          const rl = idxL[group], rr = idxR[group];
          const sl = shiftsL[group], sr = shiftsR[group];
          for (let i = 0; i < 16; i++) {
            const tl = rotl(al + f(group, bl, cl, dl) + BUF[rl[i]] + hbl, sl[i]) + el | 0;
            al = el, el = dl, dl = rotl(cl, 10) | 0, cl = bl, bl = tl;
          }
          for (let i = 0; i < 16; i++) {
            const tr = rotl(ar + f(rGroup, br, cr, dr) + BUF[rr[i]] + hbr, sr[i]) + er | 0;
            ar = er, er = dr, dr = rotl(cr, 10) | 0, cr = br, br = tr;
          }
        }
        this.set(this.h1 + cl + dr | 0, this.h2 + dl + er | 0, this.h3 + el + ar | 0, this.h4 + al + br | 0, this.h0 + bl + cr | 0);
      }
      roundClean() {
        BUF.fill(0);
      }
      destroy() {
        this.destroyed = true;
        this.buffer.fill(0);
        this.set(0, 0, 0, 0, 0);
      }
    };
    exports.RIPEMD160 = RIPEMD160;
    exports.ripemd160 = (0, utils_js_1.wrapConstructor)(() => new RIPEMD160());
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/sha1.js
var require_sha1 = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/sha1.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sha1 = void 0;
    var _sha2_js_1 = require_sha2();
    var utils_js_1 = require_utils();
    var rotl = (word, shift) => word << shift | word >>> 32 - shift >>> 0;
    var Chi = (a, b, c) => a & b ^ ~a & c;
    var Maj = (a, b, c) => a & b ^ a & c ^ b & c;
    var IV = /* @__PURE__ */ new Uint32Array([
      1732584193,
      4023233417,
      2562383102,
      271733878,
      3285377520
    ]);
    var SHA1_W = /* @__PURE__ */ new Uint32Array(80);
    var SHA1 = class extends _sha2_js_1.SHA2 {
      constructor() {
        super(64, 20, 8, false);
        this.A = IV[0] | 0;
        this.B = IV[1] | 0;
        this.C = IV[2] | 0;
        this.D = IV[3] | 0;
        this.E = IV[4] | 0;
      }
      get() {
        const { A, B, C, D, E } = this;
        return [A, B, C, D, E];
      }
      set(A, B, C, D, E) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA1_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 80; i++)
          SHA1_W[i] = rotl(SHA1_W[i - 3] ^ SHA1_W[i - 8] ^ SHA1_W[i - 14] ^ SHA1_W[i - 16], 1);
        let { A, B, C, D, E } = this;
        for (let i = 0; i < 80; i++) {
          let F, K;
          if (i < 20) {
            F = Chi(B, C, D);
            K = 1518500249;
          } else if (i < 40) {
            F = B ^ C ^ D;
            K = 1859775393;
          } else if (i < 60) {
            F = Maj(B, C, D);
            K = 2400959708;
          } else {
            F = B ^ C ^ D;
            K = 3395469782;
          }
          const T = rotl(A, 5) + F + E + K + SHA1_W[i] | 0;
          E = D;
          D = C;
          C = rotl(B, 30);
          B = A;
          A = T;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E = E + this.E | 0;
        this.set(A, B, C, D, E);
      }
      roundClean() {
        SHA1_W.fill(0);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0);
        this.buffer.fill(0);
      }
    };
    exports.sha1 = (0, utils_js_1.wrapConstructor)(() => new SHA1());
  }
});

// node_modules/belcoinjs-lib/node_modules/@noble/hashes/sha256.js
var require_sha256 = __commonJS({
  "node_modules/belcoinjs-lib/node_modules/@noble/hashes/sha256.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sha224 = exports.sha256 = void 0;
    var _sha2_js_1 = require_sha2();
    var utils_js_1 = require_utils();
    var Chi = (a, b, c) => a & b ^ ~a & c;
    var Maj = (a, b, c) => a & b ^ a & c ^ b & c;
    var SHA256_K = /* @__PURE__ */ new Uint32Array([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    var IV = /* @__PURE__ */ new Uint32Array([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    var SHA256 = class extends _sha2_js_1.SHA2 {
      constructor() {
        super(64, 32, 8, false);
        this.A = IV[0] | 0;
        this.B = IV[1] | 0;
        this.C = IV[2] | 0;
        this.D = IV[3] | 0;
        this.E = IV[4] | 0;
        this.F = IV[5] | 0;
        this.G = IV[6] | 0;
        this.H = IV[7] | 0;
      }
      get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
      }
      // prettier-ignore
      set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = (0, utils_js_1.rotr)(W15, 7) ^ (0, utils_js_1.rotr)(W15, 18) ^ W15 >>> 3;
          const s1 = (0, utils_js_1.rotr)(W2, 17) ^ (0, utils_js_1.rotr)(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = (0, utils_js_1.rotr)(E, 6) ^ (0, utils_js_1.rotr)(E, 11) ^ (0, utils_js_1.rotr)(E, 25);
          const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = (0, utils_js_1.rotr)(A, 2) ^ (0, utils_js_1.rotr)(A, 13) ^ (0, utils_js_1.rotr)(A, 22);
          const T2 = sigma0 + Maj(A, B, C) | 0;
          H = G;
          G = F;
          F = E;
          E = D + T1 | 0;
          D = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E = E + this.E | 0;
        F = F + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D, E, F, G, H);
      }
      roundClean() {
        SHA256_W.fill(0);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        this.buffer.fill(0);
      }
    };
    var SHA224 = class extends SHA256 {
      constructor() {
        super();
        this.A = 3238371032 | 0;
        this.B = 914150663 | 0;
        this.C = 812702999 | 0;
        this.D = 4144912697 | 0;
        this.E = 4290775857 | 0;
        this.F = 1750603025 | 0;
        this.G = 1694076839 | 0;
        this.H = 3204075428 | 0;
        this.outputLen = 28;
      }
    };
    exports.sha256 = (0, utils_js_1.wrapConstructor)(() => new SHA256());
    exports.sha224 = (0, utils_js_1.wrapConstructor)(() => new SHA224());
  }
});

// node_modules/belcoinjs-lib/src/crypto.js
var require_crypto2 = __commonJS({
  "node_modules/belcoinjs-lib/src/crypto.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.taggedHash = exports.TAGGED_HASH_PREFIXES = exports.TAGS = exports.hash256 = exports.hash160 = exports.sha256 = exports.sha1 = exports.ripemd160 = void 0;
    var ripemd160_1 = require_ripemd160();
    var sha1_1 = require_sha1();
    var sha256_1 = require_sha256();
    function ripemd160(buffer) {
      return Buffer2.from((0, ripemd160_1.ripemd160)(Uint8Array.from(buffer)));
    }
    exports.ripemd160 = ripemd160;
    function sha1(buffer) {
      return Buffer2.from((0, sha1_1.sha1)(Uint8Array.from(buffer)));
    }
    exports.sha1 = sha1;
    function sha256(buffer) {
      return Buffer2.from((0, sha256_1.sha256)(Uint8Array.from(buffer)));
    }
    exports.sha256 = sha256;
    function hash160(buffer) {
      return Buffer2.from(
        (0, ripemd160_1.ripemd160)((0, sha256_1.sha256)(Uint8Array.from(buffer)))
      );
    }
    exports.hash160 = hash160;
    function hash256(buffer) {
      return Buffer2.from(
        (0, sha256_1.sha256)((0, sha256_1.sha256)(Uint8Array.from(buffer)))
      );
    }
    exports.hash256 = hash256;
    exports.TAGS = [
      "BIP0340/challenge",
      "BIP0340/aux",
      "BIP0340/nonce",
      "TapLeaf",
      "TapBranch",
      "TapSighash",
      "TapTweak",
      "KeyAgg list",
      "KeyAgg coefficient"
    ];
    exports.TAGGED_HASH_PREFIXES = {
      "BIP0340/challenge": Buffer2.from([
        123,
        181,
        45,
        122,
        159,
        239,
        88,
        50,
        62,
        177,
        191,
        122,
        64,
        125,
        179,
        130,
        210,
        243,
        242,
        216,
        27,
        177,
        34,
        79,
        73,
        254,
        81,
        143,
        109,
        72,
        211,
        124,
        123,
        181,
        45,
        122,
        159,
        239,
        88,
        50,
        62,
        177,
        191,
        122,
        64,
        125,
        179,
        130,
        210,
        243,
        242,
        216,
        27,
        177,
        34,
        79,
        73,
        254,
        81,
        143,
        109,
        72,
        211,
        124
      ]),
      "BIP0340/aux": Buffer2.from([
        241,
        239,
        78,
        94,
        192,
        99,
        202,
        218,
        109,
        148,
        202,
        250,
        157,
        152,
        126,
        160,
        105,
        38,
        88,
        57,
        236,
        193,
        31,
        151,
        45,
        119,
        165,
        46,
        216,
        193,
        204,
        144,
        241,
        239,
        78,
        94,
        192,
        99,
        202,
        218,
        109,
        148,
        202,
        250,
        157,
        152,
        126,
        160,
        105,
        38,
        88,
        57,
        236,
        193,
        31,
        151,
        45,
        119,
        165,
        46,
        216,
        193,
        204,
        144
      ]),
      "BIP0340/nonce": Buffer2.from([
        7,
        73,
        119,
        52,
        167,
        155,
        203,
        53,
        91,
        155,
        140,
        125,
        3,
        79,
        18,
        28,
        244,
        52,
        215,
        62,
        247,
        45,
        218,
        25,
        135,
        0,
        97,
        251,
        82,
        191,
        235,
        47,
        7,
        73,
        119,
        52,
        167,
        155,
        203,
        53,
        91,
        155,
        140,
        125,
        3,
        79,
        18,
        28,
        244,
        52,
        215,
        62,
        247,
        45,
        218,
        25,
        135,
        0,
        97,
        251,
        82,
        191,
        235,
        47
      ]),
      TapLeaf: Buffer2.from([
        174,
        234,
        143,
        220,
        66,
        8,
        152,
        49,
        5,
        115,
        75,
        88,
        8,
        29,
        30,
        38,
        56,
        211,
        95,
        28,
        181,
        64,
        8,
        212,
        211,
        87,
        202,
        3,
        190,
        120,
        233,
        238,
        174,
        234,
        143,
        220,
        66,
        8,
        152,
        49,
        5,
        115,
        75,
        88,
        8,
        29,
        30,
        38,
        56,
        211,
        95,
        28,
        181,
        64,
        8,
        212,
        211,
        87,
        202,
        3,
        190,
        120,
        233,
        238
      ]),
      TapBranch: Buffer2.from([
        25,
        65,
        161,
        242,
        229,
        110,
        185,
        95,
        162,
        169,
        241,
        148,
        190,
        92,
        1,
        247,
        33,
        111,
        51,
        237,
        130,
        176,
        145,
        70,
        52,
        144,
        208,
        91,
        245,
        22,
        160,
        21,
        25,
        65,
        161,
        242,
        229,
        110,
        185,
        95,
        162,
        169,
        241,
        148,
        190,
        92,
        1,
        247,
        33,
        111,
        51,
        237,
        130,
        176,
        145,
        70,
        52,
        144,
        208,
        91,
        245,
        22,
        160,
        21
      ]),
      TapSighash: Buffer2.from([
        244,
        10,
        72,
        223,
        75,
        42,
        112,
        200,
        180,
        146,
        75,
        242,
        101,
        70,
        97,
        237,
        61,
        149,
        253,
        102,
        163,
        19,
        235,
        135,
        35,
        117,
        151,
        198,
        40,
        228,
        160,
        49,
        244,
        10,
        72,
        223,
        75,
        42,
        112,
        200,
        180,
        146,
        75,
        242,
        101,
        70,
        97,
        237,
        61,
        149,
        253,
        102,
        163,
        19,
        235,
        135,
        35,
        117,
        151,
        198,
        40,
        228,
        160,
        49
      ]),
      TapTweak: Buffer2.from([
        232,
        15,
        225,
        99,
        156,
        156,
        160,
        80,
        227,
        175,
        27,
        57,
        193,
        67,
        198,
        62,
        66,
        156,
        188,
        235,
        21,
        217,
        64,
        251,
        181,
        197,
        161,
        244,
        175,
        87,
        197,
        233,
        232,
        15,
        225,
        99,
        156,
        156,
        160,
        80,
        227,
        175,
        27,
        57,
        193,
        67,
        198,
        62,
        66,
        156,
        188,
        235,
        21,
        217,
        64,
        251,
        181,
        197,
        161,
        244,
        175,
        87,
        197,
        233
      ]),
      "KeyAgg list": Buffer2.from([
        72,
        28,
        151,
        28,
        60,
        11,
        70,
        215,
        240,
        178,
        117,
        174,
        89,
        141,
        78,
        44,
        126,
        215,
        49,
        156,
        89,
        74,
        92,
        110,
        199,
        158,
        160,
        212,
        153,
        2,
        148,
        240,
        72,
        28,
        151,
        28,
        60,
        11,
        70,
        215,
        240,
        178,
        117,
        174,
        89,
        141,
        78,
        44,
        126,
        215,
        49,
        156,
        89,
        74,
        92,
        110,
        199,
        158,
        160,
        212,
        153,
        2,
        148,
        240
      ]),
      "KeyAgg coefficient": Buffer2.from([
        191,
        201,
        4,
        3,
        77,
        28,
        136,
        232,
        200,
        14,
        34,
        229,
        61,
        36,
        86,
        109,
        100,
        130,
        78,
        214,
        66,
        114,
        129,
        192,
        145,
        0,
        249,
        77,
        205,
        82,
        201,
        129,
        191,
        201,
        4,
        3,
        77,
        28,
        136,
        232,
        200,
        14,
        34,
        229,
        61,
        36,
        86,
        109,
        100,
        130,
        78,
        214,
        66,
        114,
        129,
        192,
        145,
        0,
        249,
        77,
        205,
        82,
        201,
        129
      ])
    };
    function taggedHash(prefix, data) {
      return sha256(Buffer2.concat([exports.TAGGED_HASH_PREFIXES[prefix], data]));
    }
    exports.taggedHash = taggedHash;
  }
});

// node_modules/@noble/hashes/_assert.js
var require_assert2 = __commonJS({
  "node_modules/@noble/hashes/_assert.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.output = exports.exists = exports.hash = exports.bytes = exports.bool = exports.number = exports.isBytes = void 0;
    function number(n) {
      if (!Number.isSafeInteger(n) || n < 0)
        throw new Error(`positive integer expected, not ${n}`);
    }
    exports.number = number;
    function bool(b) {
      if (typeof b !== "boolean")
        throw new Error(`boolean expected, not ${b}`);
    }
    exports.bool = bool;
    function isBytes(a) {
      return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
    }
    exports.isBytes = isBytes;
    function bytes(b, ...lengths) {
      if (!isBytes(b))
        throw new Error("Uint8Array expected");
      if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b.length}`);
    }
    exports.bytes = bytes;
    function hash(h) {
      if (typeof h !== "function" || typeof h.create !== "function")
        throw new Error("Hash should be wrapped by utils.wrapConstructor");
      number(h.outputLen);
      number(h.blockLen);
    }
    exports.hash = hash;
    function exists(instance, checkFinished = true) {
      if (instance.destroyed)
        throw new Error("Hash instance has been destroyed");
      if (checkFinished && instance.finished)
        throw new Error("Hash#digest() has already been called");
    }
    exports.exists = exists;
    function output(out, instance) {
      bytes(out);
      const min = instance.outputLen;
      if (out.length < min) {
        throw new Error(`digestInto() expects output buffer of length at least ${min}`);
      }
    }
    exports.output = output;
    var assert = { number, bool, bytes, hash, exists, output };
    exports.default = assert;
  }
});

// node_modules/@noble/hashes/crypto.js
var require_crypto3 = __commonJS({
  "node_modules/@noble/hashes/crypto.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.crypto = void 0;
    exports.crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
  }
});

// node_modules/@noble/hashes/utils.js
var require_utils2 = __commonJS({
  "node_modules/@noble/hashes/utils.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.randomBytes = exports.wrapXOFConstructorWithOpts = exports.wrapConstructorWithOpts = exports.wrapConstructor = exports.checkOpts = exports.Hash = exports.concatBytes = exports.toBytes = exports.utf8ToBytes = exports.asyncLoop = exports.nextTick = exports.hexToBytes = exports.bytesToHex = exports.byteSwap32 = exports.byteSwapIfBE = exports.byteSwap = exports.isLE = exports.rotl = exports.rotr = exports.createView = exports.u32 = exports.u8 = exports.isBytes = void 0;
    var crypto_1 = require_crypto3();
    var _assert_js_1 = require_assert2();
    function isBytes(a) {
      return a instanceof Uint8Array || a != null && typeof a === "object" && a.constructor.name === "Uint8Array";
    }
    exports.isBytes = isBytes;
    var u8 = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    exports.u8 = u8;
    var u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
    exports.u32 = u32;
    var createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
    exports.createView = createView;
    var rotr = (word, shift) => word << 32 - shift | word >>> shift;
    exports.rotr = rotr;
    var rotl = (word, shift) => word << shift | word >>> 32 - shift >>> 0;
    exports.rotl = rotl;
    exports.isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
    var byteSwap = (word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
    exports.byteSwap = byteSwap;
    exports.byteSwapIfBE = exports.isLE ? (n) => n : (n) => (0, exports.byteSwap)(n);
    function byteSwap32(arr) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = (0, exports.byteSwap)(arr[i]);
      }
    }
    exports.byteSwap32 = byteSwap32;
    var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
    function bytesToHex(bytes) {
      (0, _assert_js_1.bytes)(bytes);
      let hex = "";
      for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
      }
      return hex;
    }
    exports.bytesToHex = bytesToHex;
    var asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
    function asciiToBase16(char) {
      if (char >= asciis._0 && char <= asciis._9)
        return char - asciis._0;
      if (char >= asciis._A && char <= asciis._F)
        return char - (asciis._A - 10);
      if (char >= asciis._a && char <= asciis._f)
        return char - (asciis._a - 10);
      return;
    }
    function hexToBytes(hex) {
      if (typeof hex !== "string")
        throw new Error("hex string expected, got " + typeof hex);
      const hl = hex.length;
      const al = hl / 2;
      if (hl % 2)
        throw new Error("padded hex string expected, got unpadded hex of length " + hl);
      const array = new Uint8Array(al);
      for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === void 0 || n2 === void 0) {
          const char = hex[hi] + hex[hi + 1];
          throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2;
      }
      return array;
    }
    exports.hexToBytes = hexToBytes;
    var nextTick = async () => {
    };
    exports.nextTick = nextTick;
    async function asyncLoop(iters, tick, cb) {
      let ts = Date.now();
      for (let i = 0; i < iters; i++) {
        cb(i);
        const diff = Date.now() - ts;
        if (diff >= 0 && diff < tick)
          continue;
        await (0, exports.nextTick)();
        ts += diff;
      }
    }
    exports.asyncLoop = asyncLoop;
    function utf8ToBytes(str) {
      if (typeof str !== "string")
        throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
      return new Uint8Array(new TextEncoder().encode(str));
    }
    exports.utf8ToBytes = utf8ToBytes;
    function toBytes(data) {
      if (typeof data === "string")
        data = utf8ToBytes(data);
      (0, _assert_js_1.bytes)(data);
      return data;
    }
    exports.toBytes = toBytes;
    function concatBytes(...arrays) {
      let sum = 0;
      for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        (0, _assert_js_1.bytes)(a);
        sum += a.length;
      }
      const res = new Uint8Array(sum);
      for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
      }
      return res;
    }
    exports.concatBytes = concatBytes;
    var Hash = class {
      // Safe version that clones internal state
      clone() {
        return this._cloneInto();
      }
    };
    exports.Hash = Hash;
    var toStr = {}.toString;
    function checkOpts(defaults, opts) {
      if (opts !== void 0 && toStr.call(opts) !== "[object Object]")
        throw new Error("Options should be object or undefined");
      const merged = Object.assign(defaults, opts);
      return merged;
    }
    exports.checkOpts = checkOpts;
    function wrapConstructor(hashCons) {
      const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
      const tmp = hashCons();
      hashC.outputLen = tmp.outputLen;
      hashC.blockLen = tmp.blockLen;
      hashC.create = () => hashCons();
      return hashC;
    }
    exports.wrapConstructor = wrapConstructor;
    function wrapConstructorWithOpts(hashCons) {
      const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
      const tmp = hashCons({});
      hashC.outputLen = tmp.outputLen;
      hashC.blockLen = tmp.blockLen;
      hashC.create = (opts) => hashCons(opts);
      return hashC;
    }
    exports.wrapConstructorWithOpts = wrapConstructorWithOpts;
    function wrapXOFConstructorWithOpts(hashCons) {
      const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
      const tmp = hashCons({});
      hashC.outputLen = tmp.outputLen;
      hashC.blockLen = tmp.blockLen;
      hashC.create = (opts) => hashCons(opts);
      return hashC;
    }
    exports.wrapXOFConstructorWithOpts = wrapXOFConstructorWithOpts;
    function randomBytes(bytesLength = 32) {
      if (crypto_1.crypto && typeof crypto_1.crypto.getRandomValues === "function") {
        return crypto_1.crypto.getRandomValues(new Uint8Array(bytesLength));
      }
      throw new Error("crypto.getRandomValues must be defined");
    }
    exports.randomBytes = randomBytes;
  }
});

// node_modules/@noble/hashes/_md.js
var require_md = __commonJS({
  "node_modules/@noble/hashes/_md.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HashMD = exports.Maj = exports.Chi = void 0;
    var _assert_js_1 = require_assert2();
    var utils_js_1 = require_utils2();
    function setBigUint64(view, byteOffset, value, isLE) {
      if (typeof view.setBigUint64 === "function")
        return view.setBigUint64(byteOffset, value, isLE);
      const _32n = BigInt(32);
      const _u32_max = BigInt(4294967295);
      const wh = Number(value >> _32n & _u32_max);
      const wl = Number(value & _u32_max);
      const h = isLE ? 4 : 0;
      const l = isLE ? 0 : 4;
      view.setUint32(byteOffset + h, wh, isLE);
      view.setUint32(byteOffset + l, wl, isLE);
    }
    var Chi = (a, b, c) => a & b ^ ~a & c;
    exports.Chi = Chi;
    var Maj = (a, b, c) => a & b ^ a & c ^ b & c;
    exports.Maj = Maj;
    var HashMD = class extends utils_js_1.Hash {
      constructor(blockLen, outputLen, padOffset, isLE) {
        super();
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.buffer = new Uint8Array(blockLen);
        this.view = (0, utils_js_1.createView)(this.buffer);
      }
      update(data) {
        (0, _assert_js_1.exists)(this);
        const { view, buffer, blockLen } = this;
        data = (0, utils_js_1.toBytes)(data);
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          if (take === blockLen) {
            const dataView = (0, utils_js_1.createView)(data);
            for (; blockLen <= len - pos; pos += blockLen)
              this.process(dataView, pos);
            continue;
          }
          buffer.set(data.subarray(pos, pos + take), this.pos);
          this.pos += take;
          pos += take;
          if (this.pos === blockLen) {
            this.process(view, 0);
            this.pos = 0;
          }
        }
        this.length += data.length;
        this.roundClean();
        return this;
      }
      digestInto(out) {
        (0, _assert_js_1.exists)(this);
        (0, _assert_js_1.output)(out, this);
        this.finished = true;
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        buffer[pos++] = 128;
        this.buffer.subarray(pos).fill(0);
        if (this.padOffset > blockLen - pos) {
          this.process(view, 0);
          pos = 0;
        }
        for (let i = pos; i < blockLen; i++)
          buffer[i] = 0;
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = (0, utils_js_1.createView)(out);
        const len = this.outputLen;
        if (len % 4)
          throw new Error("_sha2: outputLen should be aligned to 32bit");
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
          throw new Error("_sha2: outputLen bigger than state");
        for (let i = 0; i < outLen; i++)
          oview.setUint32(4 * i, state[i], isLE);
      }
      digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
      }
      _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.length = length;
        to.pos = pos;
        to.finished = finished;
        to.destroyed = destroyed;
        if (length % blockLen)
          to.buffer.set(buffer);
        return to;
      }
    };
    exports.HashMD = HashMD;
  }
});

// node_modules/@noble/hashes/sha256.js
var require_sha2562 = __commonJS({
  "node_modules/@noble/hashes/sha256.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.sha224 = exports.sha256 = void 0;
    var _md_js_1 = require_md();
    var utils_js_1 = require_utils2();
    var SHA256_K = /* @__PURE__ */ new Uint32Array([
      1116352408,
      1899447441,
      3049323471,
      3921009573,
      961987163,
      1508970993,
      2453635748,
      2870763221,
      3624381080,
      310598401,
      607225278,
      1426881987,
      1925078388,
      2162078206,
      2614888103,
      3248222580,
      3835390401,
      4022224774,
      264347078,
      604807628,
      770255983,
      1249150122,
      1555081692,
      1996064986,
      2554220882,
      2821834349,
      2952996808,
      3210313671,
      3336571891,
      3584528711,
      113926993,
      338241895,
      666307205,
      773529912,
      1294757372,
      1396182291,
      1695183700,
      1986661051,
      2177026350,
      2456956037,
      2730485921,
      2820302411,
      3259730800,
      3345764771,
      3516065817,
      3600352804,
      4094571909,
      275423344,
      430227734,
      506948616,
      659060556,
      883997877,
      958139571,
      1322822218,
      1537002063,
      1747873779,
      1955562222,
      2024104815,
      2227730452,
      2361852424,
      2428436474,
      2756734187,
      3204031479,
      3329325298
    ]);
    var SHA256_IV = /* @__PURE__ */ new Uint32Array([
      1779033703,
      3144134277,
      1013904242,
      2773480762,
      1359893119,
      2600822924,
      528734635,
      1541459225
    ]);
    var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
    var SHA256 = class extends _md_js_1.HashMD {
      constructor() {
        super(64, 32, 8, false);
        this.A = SHA256_IV[0] | 0;
        this.B = SHA256_IV[1] | 0;
        this.C = SHA256_IV[2] | 0;
        this.D = SHA256_IV[3] | 0;
        this.E = SHA256_IV[4] | 0;
        this.F = SHA256_IV[5] | 0;
        this.G = SHA256_IV[6] | 0;
        this.H = SHA256_IV[7] | 0;
      }
      get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
      }
      // prettier-ignore
      set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
      }
      process(view, offset) {
        for (let i = 0; i < 16; i++, offset += 4)
          SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
          const W15 = SHA256_W[i - 15];
          const W2 = SHA256_W[i - 2];
          const s0 = (0, utils_js_1.rotr)(W15, 7) ^ (0, utils_js_1.rotr)(W15, 18) ^ W15 >>> 3;
          const s1 = (0, utils_js_1.rotr)(W2, 17) ^ (0, utils_js_1.rotr)(W2, 19) ^ W2 >>> 10;
          SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
        }
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
          const sigma1 = (0, utils_js_1.rotr)(E, 6) ^ (0, utils_js_1.rotr)(E, 11) ^ (0, utils_js_1.rotr)(E, 25);
          const T1 = H + sigma1 + (0, _md_js_1.Chi)(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
          const sigma0 = (0, utils_js_1.rotr)(A, 2) ^ (0, utils_js_1.rotr)(A, 13) ^ (0, utils_js_1.rotr)(A, 22);
          const T2 = sigma0 + (0, _md_js_1.Maj)(A, B, C) | 0;
          H = G;
          G = F;
          F = E;
          E = D + T1 | 0;
          D = C;
          C = B;
          B = A;
          A = T1 + T2 | 0;
        }
        A = A + this.A | 0;
        B = B + this.B | 0;
        C = C + this.C | 0;
        D = D + this.D | 0;
        E = E + this.E | 0;
        F = F + this.F | 0;
        G = G + this.G | 0;
        H = H + this.H | 0;
        this.set(A, B, C, D, E, F, G, H);
      }
      roundClean() {
        SHA256_W.fill(0);
      }
      destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        this.buffer.fill(0);
      }
    };
    var SHA224 = class extends SHA256 {
      constructor() {
        super();
        this.A = 3238371032 | 0;
        this.B = 914150663 | 0;
        this.C = 812702999 | 0;
        this.D = 4144912697 | 0;
        this.E = 4290775857 | 0;
        this.F = 1750603025 | 0;
        this.G = 1694076839 | 0;
        this.H = 3204075428 | 0;
        this.outputLen = 28;
      }
    };
    exports.sha256 = (0, utils_js_1.wrapConstructor)(() => new SHA256());
    exports.sha224 = (0, utils_js_1.wrapConstructor)(() => new SHA224());
  }
});

// node_modules/base-x/src/index.js
var require_src = __commonJS({
  "node_modules/base-x/src/index.js"(exports, module) {
    "use strict";
    init_buffer_shim();
    function base(ALPHABET) {
      if (ALPHABET.length >= 255) {
        throw new TypeError("Alphabet too long");
      }
      var BASE_MAP = new Uint8Array(256);
      for (var j = 0; j < BASE_MAP.length; j++) {
        BASE_MAP[j] = 255;
      }
      for (var i = 0; i < ALPHABET.length; i++) {
        var x = ALPHABET.charAt(i);
        var xc = x.charCodeAt(0);
        if (BASE_MAP[xc] !== 255) {
          throw new TypeError(x + " is ambiguous");
        }
        BASE_MAP[xc] = i;
      }
      var BASE = ALPHABET.length;
      var LEADER = ALPHABET.charAt(0);
      var FACTOR = Math.log(BASE) / Math.log(256);
      var iFACTOR = Math.log(256) / Math.log(BASE);
      function encode(source) {
        if (source instanceof Uint8Array) {
        } else if (ArrayBuffer.isView(source)) {
          source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
        } else if (Array.isArray(source)) {
          source = Uint8Array.from(source);
        }
        if (!(source instanceof Uint8Array)) {
          throw new TypeError("Expected Uint8Array");
        }
        if (source.length === 0) {
          return "";
        }
        var zeroes = 0;
        var length = 0;
        var pbegin = 0;
        var pend = source.length;
        while (pbegin !== pend && source[pbegin] === 0) {
          pbegin++;
          zeroes++;
        }
        var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
        var b58 = new Uint8Array(size);
        while (pbegin !== pend) {
          var carry = source[pbegin];
          var i2 = 0;
          for (var it1 = size - 1; (carry !== 0 || i2 < length) && it1 !== -1; it1--, i2++) {
            carry += 256 * b58[it1] >>> 0;
            b58[it1] = carry % BASE >>> 0;
            carry = carry / BASE >>> 0;
          }
          if (carry !== 0) {
            throw new Error("Non-zero carry");
          }
          length = i2;
          pbegin++;
        }
        var it2 = size - length;
        while (it2 !== size && b58[it2] === 0) {
          it2++;
        }
        var str = LEADER.repeat(zeroes);
        for (; it2 < size; ++it2) {
          str += ALPHABET.charAt(b58[it2]);
        }
        return str;
      }
      function decodeUnsafe(source) {
        if (typeof source !== "string") {
          throw new TypeError("Expected String");
        }
        if (source.length === 0) {
          return new Uint8Array();
        }
        var psz = 0;
        var zeroes = 0;
        var length = 0;
        while (source[psz] === LEADER) {
          zeroes++;
          psz++;
        }
        var size = (source.length - psz) * FACTOR + 1 >>> 0;
        var b256 = new Uint8Array(size);
        while (source[psz]) {
          var charCode = source.charCodeAt(psz);
          if (charCode > 255) {
            return;
          }
          var carry = BASE_MAP[charCode];
          if (carry === 255) {
            return;
          }
          var i2 = 0;
          for (var it3 = size - 1; (carry !== 0 || i2 < length) && it3 !== -1; it3--, i2++) {
            carry += BASE * b256[it3] >>> 0;
            b256[it3] = carry % 256 >>> 0;
            carry = carry / 256 >>> 0;
          }
          if (carry !== 0) {
            throw new Error("Non-zero carry");
          }
          length = i2;
          psz++;
        }
        var it4 = size - length;
        while (it4 !== size && b256[it4] === 0) {
          it4++;
        }
        var vch = new Uint8Array(zeroes + (size - it4));
        var j2 = zeroes;
        while (it4 !== size) {
          vch[j2++] = b256[it4++];
        }
        return vch;
      }
      function decode(string) {
        var buffer = decodeUnsafe(string);
        if (buffer) {
          return buffer;
        }
        throw new Error("Non-base" + BASE + " character");
      }
      return {
        encode,
        decodeUnsafe,
        decode
      };
    }
    module.exports = base;
  }
});

// node_modules/bs58/index.js
var require_bs58 = __commonJS({
  "node_modules/bs58/index.js"(exports, module) {
    init_buffer_shim();
    var basex = require_src();
    var ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    module.exports = basex(ALPHABET);
  }
});

// node_modules/bs58check/base.js
var require_base = __commonJS({
  "node_modules/bs58check/base.js"(exports, module) {
    "use strict";
    init_buffer_shim();
    var base58 = require_bs58();
    module.exports = function(checksumFn) {
      function encode(payload) {
        var payloadU8 = Uint8Array.from(payload);
        var checksum = checksumFn(payloadU8);
        var length = payloadU8.length + 4;
        var both = new Uint8Array(length);
        both.set(payloadU8, 0);
        both.set(checksum.subarray(0, 4), payloadU8.length);
        return base58.encode(both, length);
      }
      function decodeRaw(buffer) {
        var payload = buffer.slice(0, -4);
        var checksum = buffer.slice(-4);
        var newChecksum = checksumFn(payload);
        if (checksum[0] ^ newChecksum[0] | checksum[1] ^ newChecksum[1] | checksum[2] ^ newChecksum[2] | checksum[3] ^ newChecksum[3]) return;
        return payload;
      }
      function decodeUnsafe(string) {
        var buffer = base58.decodeUnsafe(string);
        if (!buffer) return;
        return decodeRaw(buffer);
      }
      function decode(string) {
        var buffer = base58.decode(string);
        var payload = decodeRaw(buffer, checksumFn);
        if (!payload) throw new Error("Invalid checksum");
        return payload;
      }
      return {
        encode,
        decode,
        decodeUnsafe
      };
    };
  }
});

// node_modules/bs58check/index.js
var require_bs58check = __commonJS({
  "node_modules/bs58check/index.js"(exports, module) {
    "use strict";
    init_buffer_shim();
    var { sha256 } = require_sha2562();
    var bs58checkBase = require_base();
    function sha256x2(buffer) {
      return sha256(sha256(buffer));
    }
    module.exports = bs58checkBase(sha256x2);
  }
});

// node_modules/belcoinjs-lib/src/payments/p2pkh.js
var require_p2pkh = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2pkh.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2pkh = void 0;
    var bcrypto = require_crypto2();
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var bs58check = require_bs58check();
    var OPS = bscript2.OPS;
    function p2pkh(a, opts) {
      if (!a.address && !a.hash && !a.output && !a.pubkey && !a.input)
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          address: types_1.typeforce.maybe(types_1.typeforce.String),
          hash: types_1.typeforce.maybe(types_1.typeforce.BufferN(20)),
          output: types_1.typeforce.maybe(types_1.typeforce.BufferN(25)),
          pubkey: types_1.typeforce.maybe(types_1.isPoint),
          signature: types_1.typeforce.maybe(bscript2.isCanonicalScriptSignature),
          input: types_1.typeforce.maybe(types_1.typeforce.Buffer)
        },
        a
      );
      const _address = lazy.value(() => {
        const payload = Buffer2.from(bs58check.decode(a.address));
        const version = payload.readUInt8(0);
        const hash = payload.slice(1);
        return { version, hash };
      });
      const _chunks = lazy.value(() => {
        return bscript2.decompile(a.input);
      });
      const network = a.network || networks_1.bellcoin;
      const o = { name: "p2pkh", network };
      lazy.prop(o, "address", () => {
        if (!o.hash) return;
        const payload = Buffer2.allocUnsafe(21);
        payload.writeUInt8(network.pubKeyHash, 0);
        o.hash.copy(payload, 1);
        return bs58check.encode(payload);
      });
      lazy.prop(o, "hash", () => {
        if (a.output) return a.output.slice(3, 23);
        if (a.address) return _address().hash;
        if (a.pubkey || o.pubkey) return bcrypto.hash160(a.pubkey || o.pubkey);
      });
      lazy.prop(o, "output", () => {
        if (!o.hash) return;
        return bscript2.compile([
          OPS.OP_DUP,
          OPS.OP_HASH160,
          o.hash,
          OPS.OP_EQUALVERIFY,
          OPS.OP_CHECKSIG
        ]);
      });
      lazy.prop(o, "pubkey", () => {
        if (!a.input) return;
        return _chunks()[1];
      });
      lazy.prop(o, "signature", () => {
        if (!a.input) return;
        return _chunks()[0];
      });
      lazy.prop(o, "input", () => {
        if (!a.pubkey) return;
        if (!a.signature) return;
        return bscript2.compile([a.signature, a.pubkey]);
      });
      lazy.prop(o, "witness", () => {
        if (!o.input) return;
        return [];
      });
      if (opts.validate) {
        let hash = Buffer2.from([]);
        if (a.address) {
          if (_address().version !== network.pubKeyHash)
            throw new TypeError("Invalid version or Network mismatch");
          if (_address().hash.length !== 20) throw new TypeError("Invalid address");
          hash = _address().hash;
        }
        if (a.hash) {
          if (hash.length > 0 && !hash.equals(a.hash))
            throw new TypeError("Hash mismatch");
          else hash = a.hash;
        }
        if (a.output) {
          if (a.output.length !== 25 || a.output[0] !== OPS.OP_DUP || a.output[1] !== OPS.OP_HASH160 || a.output[2] !== 20 || a.output[23] !== OPS.OP_EQUALVERIFY || a.output[24] !== OPS.OP_CHECKSIG)
            throw new TypeError("Output is invalid");
          const hash2 = a.output.slice(3, 23);
          if (hash.length > 0 && !hash.equals(hash2))
            throw new TypeError("Hash mismatch");
          else hash = hash2;
        }
        if (a.pubkey) {
          const pkh = bcrypto.hash160(a.pubkey);
          if (hash.length > 0 && !hash.equals(pkh))
            throw new TypeError("Hash mismatch");
          else hash = pkh;
        }
        if (a.input) {
          const chunks = _chunks();
          if (chunks.length !== 2) throw new TypeError("Input is invalid");
          if (!bscript2.isCanonicalScriptSignature(chunks[0]))
            throw new TypeError("Input has invalid signature");
          if (!(0, types_1.isPoint)(chunks[1]))
            throw new TypeError("Input has invalid pubkey");
          if (a.signature && !a.signature.equals(chunks[0]))
            throw new TypeError("Signature mismatch");
          if (a.pubkey && !a.pubkey.equals(chunks[1]))
            throw new TypeError("Pubkey mismatch");
          const pkh = bcrypto.hash160(chunks[1]);
          if (hash.length > 0 && !hash.equals(pkh))
            throw new TypeError("Hash mismatch");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2pkh = p2pkh;
  }
});

// node_modules/belcoinjs-lib/src/payments/p2sh.js
var require_p2sh = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2sh.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2sh = void 0;
    var bcrypto = require_crypto2();
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var bs58check = require_bs58check();
    var OPS = bscript2.OPS;
    function p2sh(a, opts) {
      if (!a.address && !a.hash && !a.output && !a.redeem && !a.input)
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          address: types_1.typeforce.maybe(types_1.typeforce.String),
          hash: types_1.typeforce.maybe(types_1.typeforce.BufferN(20)),
          output: types_1.typeforce.maybe(types_1.typeforce.BufferN(23)),
          redeem: types_1.typeforce.maybe({
            network: types_1.typeforce.maybe(types_1.typeforce.Object),
            output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
            input: types_1.typeforce.maybe(types_1.typeforce.Buffer),
            witness: types_1.typeforce.maybe(
              types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
            )
          }),
          input: types_1.typeforce.maybe(types_1.typeforce.Buffer),
          witness: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
          )
        },
        a
      );
      let network = a.network;
      if (!network) {
        network = a.redeem && a.redeem.network || networks_1.bellcoin;
      }
      const o = { network };
      const _address = lazy.value(() => {
        const payload = Buffer2.from(bs58check.decode(a.address));
        const version = payload.readUInt8(0);
        const hash = payload.slice(1);
        return { version, hash };
      });
      const _chunks = lazy.value(() => {
        return bscript2.decompile(a.input);
      });
      const _redeem = lazy.value(() => {
        const chunks = _chunks();
        const lastChunk = chunks[chunks.length - 1];
        return {
          network,
          output: lastChunk === OPS.OP_FALSE ? Buffer2.from([]) : lastChunk,
          input: bscript2.compile(chunks.slice(0, -1)),
          witness: a.witness || []
        };
      });
      lazy.prop(o, "address", () => {
        if (!o.hash) return;
        const payload = Buffer2.allocUnsafe(21);
        payload.writeUInt8(o.network.scriptHash, 0);
        o.hash.copy(payload, 1);
        return bs58check.encode(payload);
      });
      lazy.prop(o, "hash", () => {
        if (a.output) return a.output.slice(2, 22);
        if (a.address) return _address().hash;
        if (o.redeem && o.redeem.output) return bcrypto.hash160(o.redeem.output);
      });
      lazy.prop(o, "output", () => {
        if (!o.hash) return;
        return bscript2.compile([OPS.OP_HASH160, o.hash, OPS.OP_EQUAL]);
      });
      lazy.prop(o, "redeem", () => {
        if (!a.input) return;
        return _redeem();
      });
      lazy.prop(o, "input", () => {
        if (!a.redeem || !a.redeem.input || !a.redeem.output) return;
        return bscript2.compile(
          [].concat(bscript2.decompile(a.redeem.input), a.redeem.output)
        );
      });
      lazy.prop(o, "witness", () => {
        if (o.redeem && o.redeem.witness) return o.redeem.witness;
        if (o.input) return [];
      });
      lazy.prop(o, "name", () => {
        const nameParts = ["p2sh"];
        if (o.redeem !== void 0 && o.redeem.name !== void 0)
          nameParts.push(o.redeem.name);
        return nameParts.join("-");
      });
      if (opts.validate) {
        let hash = Buffer2.from([]);
        if (a.address) {
          if (_address().version !== network.scriptHash)
            throw new TypeError("Invalid version or Network mismatch");
          if (_address().hash.length !== 20) throw new TypeError("Invalid address");
          hash = _address().hash;
        }
        if (a.hash) {
          if (hash.length > 0 && !hash.equals(a.hash))
            throw new TypeError("Hash mismatch");
          else hash = a.hash;
        }
        if (a.output) {
          if (a.output.length !== 23 || a.output[0] !== OPS.OP_HASH160 || a.output[1] !== 20 || a.output[22] !== OPS.OP_EQUAL)
            throw new TypeError("Output is invalid");
          const hash2 = a.output.slice(2, 22);
          if (hash.length > 0 && !hash.equals(hash2))
            throw new TypeError("Hash mismatch");
          else hash = hash2;
        }
        const checkRedeem = (redeem) => {
          if (redeem.output) {
            const decompile = bscript2.decompile(redeem.output);
            if (!decompile || decompile.length < 1)
              throw new TypeError("Redeem.output too short");
            if (redeem.output.byteLength > 520)
              throw new TypeError(
                "Redeem.output unspendable if larger than 520 bytes"
              );
            if (bscript2.countNonPushOnlyOPs(decompile) > 201)
              throw new TypeError(
                "Redeem.output unspendable with more than 201 non-push ops"
              );
            const hash2 = bcrypto.hash160(redeem.output);
            if (hash.length > 0 && !hash.equals(hash2))
              throw new TypeError("Hash mismatch");
            else hash = hash2;
          }
          if (redeem.input) {
            const hasInput = redeem.input.length > 0;
            const hasWitness = redeem.witness && redeem.witness.length > 0;
            if (!hasInput && !hasWitness) throw new TypeError("Empty input");
            if (hasInput && hasWitness)
              throw new TypeError("Input and witness provided");
            if (hasInput) {
              const richunks = bscript2.decompile(redeem.input);
              if (!bscript2.isPushOnly(richunks))
                throw new TypeError("Non push-only scriptSig");
            }
          }
        };
        if (a.input) {
          const chunks = _chunks();
          if (!chunks || chunks.length < 1) throw new TypeError("Input too short");
          if (!Buffer2.isBuffer(_redeem().output))
            throw new TypeError("Input is invalid");
          checkRedeem(_redeem());
        }
        if (a.redeem) {
          if (a.redeem.network && a.redeem.network !== network)
            throw new TypeError("Network mismatch");
          if (a.input) {
            const redeem = _redeem();
            if (a.redeem.output && !a.redeem.output.equals(redeem.output))
              throw new TypeError("Redeem.output mismatch");
            if (a.redeem.input && !a.redeem.input.equals(redeem.input))
              throw new TypeError("Redeem.input mismatch");
          }
          checkRedeem(a.redeem);
        }
        if (a.witness) {
          if (a.redeem && a.redeem.witness && !(0, types_1.stacksEqual)(a.redeem.witness, a.witness))
            throw new TypeError("Witness and redeem.witness mismatch");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2sh = p2sh;
  }
});

// node_modules/bech32/dist/index.js
var require_dist = __commonJS({
  "node_modules/bech32/dist/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.bech32m = exports.bech32 = void 0;
    var ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
    var ALPHABET_MAP = {};
    for (let z = 0; z < ALPHABET.length; z++) {
      const x = ALPHABET.charAt(z);
      ALPHABET_MAP[x] = z;
    }
    function polymodStep(pre) {
      const b = pre >> 25;
      return (pre & 33554431) << 5 ^ -(b >> 0 & 1) & 996825010 ^ -(b >> 1 & 1) & 642813549 ^ -(b >> 2 & 1) & 513874426 ^ -(b >> 3 & 1) & 1027748829 ^ -(b >> 4 & 1) & 705979059;
    }
    function prefixChk(prefix) {
      let chk = 1;
      for (let i = 0; i < prefix.length; ++i) {
        const c = prefix.charCodeAt(i);
        if (c < 33 || c > 126)
          return "Invalid prefix (" + prefix + ")";
        chk = polymodStep(chk) ^ c >> 5;
      }
      chk = polymodStep(chk);
      for (let i = 0; i < prefix.length; ++i) {
        const v = prefix.charCodeAt(i);
        chk = polymodStep(chk) ^ v & 31;
      }
      return chk;
    }
    function convert(data, inBits, outBits, pad) {
      let value = 0;
      let bits = 0;
      const maxV = (1 << outBits) - 1;
      const result = [];
      for (let i = 0; i < data.length; ++i) {
        value = value << inBits | data[i];
        bits += inBits;
        while (bits >= outBits) {
          bits -= outBits;
          result.push(value >> bits & maxV);
        }
      }
      if (pad) {
        if (bits > 0) {
          result.push(value << outBits - bits & maxV);
        }
      } else {
        if (bits >= inBits)
          return "Excess padding";
        if (value << outBits - bits & maxV)
          return "Non-zero padding";
      }
      return result;
    }
    function toWords(bytes) {
      return convert(bytes, 8, 5, true);
    }
    function fromWordsUnsafe(words) {
      const res = convert(words, 5, 8, false);
      if (Array.isArray(res))
        return res;
    }
    function fromWords(words) {
      const res = convert(words, 5, 8, false);
      if (Array.isArray(res))
        return res;
      throw new Error(res);
    }
    function getLibraryFromEncoding(encoding) {
      let ENCODING_CONST;
      if (encoding === "bech32") {
        ENCODING_CONST = 1;
      } else {
        ENCODING_CONST = 734539939;
      }
      function encode(prefix, words, LIMIT) {
        LIMIT = LIMIT || 90;
        if (prefix.length + 7 + words.length > LIMIT)
          throw new TypeError("Exceeds length limit");
        prefix = prefix.toLowerCase();
        let chk = prefixChk(prefix);
        if (typeof chk === "string")
          throw new Error(chk);
        let result = prefix + "1";
        for (let i = 0; i < words.length; ++i) {
          const x = words[i];
          if (x >> 5 !== 0)
            throw new Error("Non 5-bit word");
          chk = polymodStep(chk) ^ x;
          result += ALPHABET.charAt(x);
        }
        for (let i = 0; i < 6; ++i) {
          chk = polymodStep(chk);
        }
        chk ^= ENCODING_CONST;
        for (let i = 0; i < 6; ++i) {
          const v = chk >> (5 - i) * 5 & 31;
          result += ALPHABET.charAt(v);
        }
        return result;
      }
      function __decode(str, LIMIT) {
        LIMIT = LIMIT || 90;
        if (str.length < 8)
          return str + " too short";
        if (str.length > LIMIT)
          return "Exceeds length limit";
        const lowered = str.toLowerCase();
        const uppered = str.toUpperCase();
        if (str !== lowered && str !== uppered)
          return "Mixed-case string " + str;
        str = lowered;
        const split = str.lastIndexOf("1");
        if (split === -1)
          return "No separator character for " + str;
        if (split === 0)
          return "Missing prefix for " + str;
        const prefix = str.slice(0, split);
        const wordChars = str.slice(split + 1);
        if (wordChars.length < 6)
          return "Data too short";
        let chk = prefixChk(prefix);
        if (typeof chk === "string")
          return chk;
        const words = [];
        for (let i = 0; i < wordChars.length; ++i) {
          const c = wordChars.charAt(i);
          const v = ALPHABET_MAP[c];
          if (v === void 0)
            return "Unknown character " + c;
          chk = polymodStep(chk) ^ v;
          if (i + 6 >= wordChars.length)
            continue;
          words.push(v);
        }
        if (chk !== ENCODING_CONST)
          return "Invalid checksum for " + str;
        return { prefix, words };
      }
      function decodeUnsafe(str, LIMIT) {
        const res = __decode(str, LIMIT);
        if (typeof res === "object")
          return res;
      }
      function decode(str, LIMIT) {
        const res = __decode(str, LIMIT);
        if (typeof res === "object")
          return res;
        throw new Error(res);
      }
      return {
        decodeUnsafe,
        decode,
        encode,
        toWords,
        fromWordsUnsafe,
        fromWords
      };
    }
    exports.bech32 = getLibraryFromEncoding("bech32");
    exports.bech32m = getLibraryFromEncoding("bech32m");
  }
});

// node_modules/belcoinjs-lib/src/payments/p2wpkh.js
var require_p2wpkh = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2wpkh.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2wpkh = void 0;
    var bcrypto = require_crypto2();
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var bech32_1 = require_dist();
    var OPS = bscript2.OPS;
    var EMPTY_BUFFER = Buffer2.alloc(0);
    function p2wpkh(a, opts) {
      if (!a.address && !a.hash && !a.output && !a.pubkey && !a.witness)
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          address: types_1.typeforce.maybe(types_1.typeforce.String),
          hash: types_1.typeforce.maybe(types_1.typeforce.BufferN(20)),
          input: types_1.typeforce.maybe(types_1.typeforce.BufferN(0)),
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          output: types_1.typeforce.maybe(types_1.typeforce.BufferN(22)),
          pubkey: types_1.typeforce.maybe(types_1.isPoint),
          signature: types_1.typeforce.maybe(bscript2.isCanonicalScriptSignature),
          witness: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
          )
        },
        a
      );
      const _address = lazy.value(() => {
        const result = bech32_1.bech32.decode(a.address);
        const version = result.words.shift();
        const data = bech32_1.bech32.fromWords(result.words);
        return {
          version,
          prefix: result.prefix,
          data: Buffer2.from(data)
        };
      });
      const network = a.network || networks_1.bellcoin;
      const o = { name: "p2wpkh", network };
      lazy.prop(o, "address", () => {
        if (!o.hash) return;
        const words = bech32_1.bech32.toWords(o.hash);
        words.unshift(0);
        return bech32_1.bech32.encode(network.bech32, words);
      });
      lazy.prop(o, "hash", () => {
        if (a.output) return a.output.slice(2, 22);
        if (a.address) return _address().data;
        if (a.pubkey || o.pubkey) return bcrypto.hash160(a.pubkey || o.pubkey);
      });
      lazy.prop(o, "output", () => {
        if (!o.hash) return;
        return bscript2.compile([OPS.OP_0, o.hash]);
      });
      lazy.prop(o, "pubkey", () => {
        if (a.pubkey) return a.pubkey;
        if (!a.witness) return;
        return a.witness[1];
      });
      lazy.prop(o, "signature", () => {
        if (!a.witness) return;
        return a.witness[0];
      });
      lazy.prop(o, "input", () => {
        if (!o.witness) return;
        return EMPTY_BUFFER;
      });
      lazy.prop(o, "witness", () => {
        if (!a.pubkey) return;
        if (!a.signature) return;
        return [a.signature, a.pubkey];
      });
      if (opts.validate) {
        let hash = Buffer2.from([]);
        if (a.address) {
          if (network && network.bech32 !== _address().prefix)
            throw new TypeError("Invalid prefix or Network mismatch");
          if (_address().version !== 0)
            throw new TypeError("Invalid address version");
          if (_address().data.length !== 20)
            throw new TypeError("Invalid address data");
          hash = _address().data;
        }
        if (a.hash) {
          if (hash.length > 0 && !hash.equals(a.hash))
            throw new TypeError("Hash mismatch");
          else hash = a.hash;
        }
        if (a.output) {
          if (a.output.length !== 22 || a.output[0] !== OPS.OP_0 || a.output[1] !== 20)
            throw new TypeError("Output is invalid");
          if (hash.length > 0 && !hash.equals(a.output.slice(2)))
            throw new TypeError("Hash mismatch");
          else hash = a.output.slice(2);
        }
        if (a.pubkey) {
          const pkh = bcrypto.hash160(a.pubkey);
          if (hash.length > 0 && !hash.equals(pkh))
            throw new TypeError("Hash mismatch");
          else hash = pkh;
          if (!(0, types_1.isPoint)(a.pubkey) || a.pubkey.length !== 33)
            throw new TypeError("Invalid pubkey for p2wpkh");
        }
        if (a.witness) {
          if (a.witness.length !== 2) throw new TypeError("Witness is invalid");
          if (!bscript2.isCanonicalScriptSignature(a.witness[0]))
            throw new TypeError("Witness has invalid signature");
          if (!(0, types_1.isPoint)(a.witness[1]) || a.witness[1].length !== 33)
            throw new TypeError("Witness has invalid pubkey");
          if (a.signature && !a.signature.equals(a.witness[0]))
            throw new TypeError("Signature mismatch");
          if (a.pubkey && !a.pubkey.equals(a.witness[1]))
            throw new TypeError("Pubkey mismatch");
          const pkh = bcrypto.hash160(a.witness[1]);
          if (hash.length > 0 && !hash.equals(pkh))
            throw new TypeError("Hash mismatch");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2wpkh = p2wpkh;
  }
});

// node_modules/belcoinjs-lib/src/payments/p2wsh.js
var require_p2wsh = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2wsh.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2wsh = void 0;
    var bcrypto = require_crypto2();
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var lazy = require_lazy();
    var bech32_1 = require_dist();
    var OPS = bscript2.OPS;
    var EMPTY_BUFFER = Buffer2.alloc(0);
    function chunkHasUncompressedPubkey(chunk) {
      if (Buffer2.isBuffer(chunk) && chunk.length === 65 && chunk[0] === 4 && (0, types_1.isPoint)(chunk)) {
        return true;
      } else {
        return false;
      }
    }
    function p2wsh(a, opts) {
      if (!a.address && !a.hash && !a.output && !a.redeem && !a.witness)
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          address: types_1.typeforce.maybe(types_1.typeforce.String),
          hash: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
          output: types_1.typeforce.maybe(types_1.typeforce.BufferN(34)),
          redeem: types_1.typeforce.maybe({
            input: types_1.typeforce.maybe(types_1.typeforce.Buffer),
            network: types_1.typeforce.maybe(types_1.typeforce.Object),
            output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
            witness: types_1.typeforce.maybe(
              types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
            )
          }),
          input: types_1.typeforce.maybe(types_1.typeforce.BufferN(0)),
          witness: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
          )
        },
        a
      );
      const _address = lazy.value(() => {
        const result = bech32_1.bech32.decode(a.address);
        const version = result.words.shift();
        const data = bech32_1.bech32.fromWords(result.words);
        return {
          version,
          prefix: result.prefix,
          data: Buffer2.from(data)
        };
      });
      const _rchunks = lazy.value(() => {
        return bscript2.decompile(a.redeem.input);
      });
      let network = a.network;
      if (!network) {
        network = a.redeem && a.redeem.network || networks_1.bellcoin;
      }
      const o = { network };
      lazy.prop(o, "address", () => {
        if (!o.hash) return;
        const words = bech32_1.bech32.toWords(o.hash);
        words.unshift(0);
        return bech32_1.bech32.encode(network.bech32, words);
      });
      lazy.prop(o, "hash", () => {
        if (a.output) return a.output.slice(2);
        if (a.address) return _address().data;
        if (o.redeem && o.redeem.output) return bcrypto.sha256(o.redeem.output);
      });
      lazy.prop(o, "output", () => {
        if (!o.hash) return;
        return bscript2.compile([OPS.OP_0, o.hash]);
      });
      lazy.prop(o, "redeem", () => {
        if (!a.witness) return;
        return {
          output: a.witness[a.witness.length - 1],
          input: EMPTY_BUFFER,
          witness: a.witness.slice(0, -1)
        };
      });
      lazy.prop(o, "input", () => {
        if (!o.witness) return;
        return EMPTY_BUFFER;
      });
      lazy.prop(o, "witness", () => {
        if (a.redeem && a.redeem.input && a.redeem.input.length > 0 && a.redeem.output && a.redeem.output.length > 0) {
          const stack = bscript2.toStack(_rchunks());
          o.redeem = Object.assign({ witness: stack }, a.redeem);
          o.redeem.input = EMPTY_BUFFER;
          return [].concat(stack, a.redeem.output);
        }
        if (!a.redeem) return;
        if (!a.redeem.output) return;
        if (!a.redeem.witness) return;
        return [].concat(a.redeem.witness, a.redeem.output);
      });
      lazy.prop(o, "name", () => {
        const nameParts = ["p2wsh"];
        if (o.redeem !== void 0 && o.redeem.name !== void 0)
          nameParts.push(o.redeem.name);
        return nameParts.join("-");
      });
      if (opts.validate) {
        let hash = Buffer2.from([]);
        if (a.address) {
          if (_address().prefix !== network.bech32)
            throw new TypeError("Invalid prefix or Network mismatch");
          if (_address().version !== 0)
            throw new TypeError("Invalid address version");
          if (_address().data.length !== 32)
            throw new TypeError("Invalid address data");
          hash = _address().data;
        }
        if (a.hash) {
          if (hash.length > 0 && !hash.equals(a.hash))
            throw new TypeError("Hash mismatch");
          else hash = a.hash;
        }
        if (a.output) {
          if (a.output.length !== 34 || a.output[0] !== OPS.OP_0 || a.output[1] !== 32)
            throw new TypeError("Output is invalid");
          const hash2 = a.output.slice(2);
          if (hash.length > 0 && !hash.equals(hash2))
            throw new TypeError("Hash mismatch");
          else hash = hash2;
        }
        if (a.redeem) {
          if (a.redeem.network && a.redeem.network !== network)
            throw new TypeError("Network mismatch");
          if (a.redeem.input && a.redeem.input.length > 0 && a.redeem.witness && a.redeem.witness.length > 0)
            throw new TypeError("Ambiguous witness source");
          if (a.redeem.output) {
            const decompile = bscript2.decompile(a.redeem.output);
            if (!decompile || decompile.length < 1)
              throw new TypeError("Redeem.output is invalid");
            if (a.redeem.output.byteLength > 3600)
              throw new TypeError(
                "Redeem.output unspendable if larger than 3600 bytes"
              );
            if (bscript2.countNonPushOnlyOPs(decompile) > 201)
              throw new TypeError(
                "Redeem.output unspendable with more than 201 non-push ops"
              );
            const hash2 = bcrypto.sha256(a.redeem.output);
            if (hash.length > 0 && !hash.equals(hash2))
              throw new TypeError("Hash mismatch");
            else hash = hash2;
          }
          if (a.redeem.input && !bscript2.isPushOnly(_rchunks()))
            throw new TypeError("Non push-only scriptSig");
          if (a.witness && a.redeem.witness && !(0, types_1.stacksEqual)(a.witness, a.redeem.witness))
            throw new TypeError("Witness and redeem.witness mismatch");
          if (a.redeem.input && _rchunks().some(chunkHasUncompressedPubkey) || a.redeem.output && (bscript2.decompile(a.redeem.output) || []).some(
            chunkHasUncompressedPubkey
          )) {
            throw new TypeError(
              "redeem.input or redeem.output contains uncompressed pubkey"
            );
          }
        }
        if (a.witness && a.witness.length > 0) {
          const wScript = a.witness[a.witness.length - 1];
          if (a.redeem && a.redeem.output && !a.redeem.output.equals(wScript))
            throw new TypeError("Witness and redeem.output mismatch");
          if (a.witness.some(chunkHasUncompressedPubkey) || (bscript2.decompile(wScript) || []).some(chunkHasUncompressedPubkey))
            throw new TypeError("Witness contains uncompressed pubkey");
        }
      }
      return Object.assign(o, a);
    }
    exports.p2wsh = p2wsh;
  }
});

// node_modules/safe-buffer/index.js
var require_safe_buffer = __commonJS({
  "node_modules/safe-buffer/index.js"(exports, module) {
    init_buffer_shim();
    var buffer = require_buffer();
    var Buffer3 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src) {
        dst[key] = src[key];
      }
    }
    if (Buffer3.from && Buffer3.alloc && Buffer3.allocUnsafe && Buffer3.allocUnsafeSlow) {
      module.exports = buffer;
    } else {
      copyProps(buffer, exports);
      exports.Buffer = SafeBuffer;
    }
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer3(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer3.prototype);
    copyProps(Buffer3, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number") {
        throw new TypeError("Argument must not be a number");
      }
      return Buffer3(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      var buf = Buffer3(size);
      if (fill !== void 0) {
        if (typeof encoding === "string") {
          buf.fill(fill, encoding);
        } else {
          buf.fill(fill);
        }
      } else {
        buf.fill(0);
      }
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return Buffer3(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number") {
        throw new TypeError("Argument must be a number");
      }
      return buffer.SlowBuffer(size);
    };
  }
});

// node_modules/varuint-bitcoin/index.js
var require_varuint_bitcoin = __commonJS({
  "node_modules/varuint-bitcoin/index.js"(exports, module) {
    "use strict";
    init_buffer_shim();
    var Buffer3 = require_safe_buffer().Buffer;
    var MAX_SAFE_INTEGER = 9007199254740991;
    function checkUInt53(n) {
      if (n < 0 || n > MAX_SAFE_INTEGER || n % 1 !== 0) throw new RangeError("value out of range");
    }
    function encode(number, buffer, offset) {
      checkUInt53(number);
      if (!buffer) buffer = Buffer3.allocUnsafe(encodingLength(number));
      if (!Buffer3.isBuffer(buffer)) throw new TypeError("buffer must be a Buffer instance");
      if (!offset) offset = 0;
      if (number < 253) {
        buffer.writeUInt8(number, offset);
        encode.bytes = 1;
      } else if (number <= 65535) {
        buffer.writeUInt8(253, offset);
        buffer.writeUInt16LE(number, offset + 1);
        encode.bytes = 3;
      } else if (number <= 4294967295) {
        buffer.writeUInt8(254, offset);
        buffer.writeUInt32LE(number, offset + 1);
        encode.bytes = 5;
      } else {
        buffer.writeUInt8(255, offset);
        buffer.writeUInt32LE(number >>> 0, offset + 1);
        buffer.writeUInt32LE(number / 4294967296 | 0, offset + 5);
        encode.bytes = 9;
      }
      return buffer;
    }
    function decode(buffer, offset) {
      if (!Buffer3.isBuffer(buffer)) throw new TypeError("buffer must be a Buffer instance");
      if (!offset) offset = 0;
      var first = buffer.readUInt8(offset);
      if (first < 253) {
        decode.bytes = 1;
        return first;
      } else if (first === 253) {
        decode.bytes = 3;
        return buffer.readUInt16LE(offset + 1);
      } else if (first === 254) {
        decode.bytes = 5;
        return buffer.readUInt32LE(offset + 1);
      } else {
        decode.bytes = 9;
        var lo = buffer.readUInt32LE(offset + 1);
        var hi = buffer.readUInt32LE(offset + 5);
        var number = hi * 4294967296 + lo;
        checkUInt53(number);
        return number;
      }
    }
    function encodingLength(number) {
      checkUInt53(number);
      return number < 253 ? 1 : number <= 65535 ? 3 : number <= 4294967295 ? 5 : 9;
    }
    module.exports = { encode, decode, encodingLength };
  }
});

// node_modules/belcoinjs-lib/src/bufferutils.js
var require_bufferutils = __commonJS({
  "node_modules/belcoinjs-lib/src/bufferutils.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BufferReader = exports.BufferWriter = exports.cloneBuffer = exports.reverseBuffer = exports.writeUInt64LE = exports.readUInt64LE = exports.varuint = void 0;
    var types = require_types();
    var { typeforce } = types;
    var varuint = require_varuint_bitcoin();
    exports.varuint = varuint;
    function verifuint(value, max) {
      if (typeof value !== "number")
        throw new Error("cannot write a non-number as a number");
      if (value < 0)
        throw new Error("specified a negative value for writing an unsigned value");
      if (value > max) throw new Error("RangeError: value out of range");
      if (Math.floor(value) !== value)
        throw new Error("value has a fractional component");
    }
    function readUInt64LE(buffer, offset) {
      const a = buffer.readUInt32LE(offset);
      let b = buffer.readUInt32LE(offset + 4);
      b *= 4294967296;
      verifuint(b + a, 9007199254740991);
      return b + a;
    }
    exports.readUInt64LE = readUInt64LE;
    function writeUInt64LE(buffer, value, offset) {
      verifuint(value, 9007199254740991);
      buffer.writeInt32LE(value & -1, offset);
      buffer.writeUInt32LE(Math.floor(value / 4294967296), offset + 4);
      return offset + 8;
    }
    exports.writeUInt64LE = writeUInt64LE;
    function reverseBuffer(buffer) {
      if (buffer.length < 1) return buffer;
      let j = buffer.length - 1;
      let tmp = 0;
      for (let i = 0; i < buffer.length / 2; i++) {
        tmp = buffer[i];
        buffer[i] = buffer[j];
        buffer[j] = tmp;
        j--;
      }
      return buffer;
    }
    exports.reverseBuffer = reverseBuffer;
    function cloneBuffer(buffer) {
      const clone = Buffer2.allocUnsafe(buffer.length);
      buffer.copy(clone);
      return clone;
    }
    exports.cloneBuffer = cloneBuffer;
    var BufferWriter = class _BufferWriter {
      constructor(buffer, offset = 0) {
        this.buffer = buffer;
        this.offset = offset;
        typeforce(types.tuple(types.Buffer, types.UInt32), [buffer, offset]);
      }
      static withCapacity(size) {
        return new _BufferWriter(Buffer2.alloc(size));
      }
      writeUInt8(i) {
        this.offset = this.buffer.writeUInt8(i, this.offset);
      }
      writeInt32(i) {
        this.offset = this.buffer.writeInt32LE(i, this.offset);
      }
      writeUInt32(i) {
        this.offset = this.buffer.writeUInt32LE(i, this.offset);
      }
      writeUInt64(i) {
        this.offset = writeUInt64LE(this.buffer, i, this.offset);
      }
      writeVarInt(i) {
        varuint.encode(i, this.buffer, this.offset);
        this.offset += varuint.encode.bytes;
      }
      writeSlice(slice) {
        if (this.buffer.length < this.offset + slice.length) {
          throw new Error("Cannot write slice out of bounds");
        }
        this.offset += slice.copy(this.buffer, this.offset);
      }
      writeVarSlice(slice) {
        this.writeVarInt(slice.length);
        this.writeSlice(slice);
      }
      writeVector(vector) {
        this.writeVarInt(vector.length);
        vector.forEach((buf) => this.writeVarSlice(buf));
      }
      end() {
        if (this.buffer.length === this.offset) {
          return this.buffer;
        }
        throw new Error(`buffer size ${this.buffer.length}, offset ${this.offset}`);
      }
    };
    exports.BufferWriter = BufferWriter;
    var BufferReader = class {
      constructor(buffer, offset = 0) {
        this.buffer = buffer;
        this.offset = offset;
        typeforce(types.tuple(types.Buffer, types.UInt32), [buffer, offset]);
      }
      readUInt8() {
        const result = this.buffer.readUInt8(this.offset);
        this.offset++;
        return result;
      }
      readInt32() {
        const result = this.buffer.readInt32LE(this.offset);
        this.offset += 4;
        return result;
      }
      readUInt32() {
        const result = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return result;
      }
      readUInt64() {
        const result = readUInt64LE(this.buffer, this.offset);
        this.offset += 8;
        return result;
      }
      readVarInt() {
        const vi = varuint.decode(this.buffer, this.offset);
        this.offset += varuint.decode.bytes;
        return vi;
      }
      readSlice(n) {
        if (this.buffer.length < this.offset + n) {
          throw new Error("Cannot read slice out of bounds");
        }
        const result = this.buffer.slice(this.offset, this.offset + n);
        this.offset += n;
        return result;
      }
      readVarSlice() {
        return this.readSlice(this.readVarInt());
      }
      readVector() {
        const count = this.readVarInt();
        const vector = [];
        for (let i = 0; i < count; i++) vector.push(this.readVarSlice());
        return vector;
      }
    };
    exports.BufferReader = BufferReader;
  }
});

// node_modules/bells-secp256k1/lib/validate_error.js
var require_validate_error = __commonJS({
  "node_modules/bells-secp256k1/lib/validate_error.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ERROR_BAD_RECOVERY_ID = exports.ERROR_BAD_PARITY = exports.ERROR_BAD_EXTRA_DATA = exports.ERROR_BAD_SIGNATURE = exports.ERROR_BAD_HASH = exports.ERROR_BAD_TWEAK = exports.ERROR_BAD_POINT = exports.ERROR_BAD_PRIVATE = void 0;
    exports.throwError = throwError;
    exports.ERROR_BAD_PRIVATE = 0;
    exports.ERROR_BAD_POINT = 1;
    exports.ERROR_BAD_TWEAK = 2;
    exports.ERROR_BAD_HASH = 3;
    exports.ERROR_BAD_SIGNATURE = 4;
    exports.ERROR_BAD_EXTRA_DATA = 5;
    exports.ERROR_BAD_PARITY = 6;
    exports.ERROR_BAD_RECOVERY_ID = 7;
    var ERRORS_MESSAGES = {
      [exports.ERROR_BAD_PRIVATE.toString()]: "Expected Private",
      [exports.ERROR_BAD_POINT.toString()]: "Expected Point",
      [exports.ERROR_BAD_TWEAK.toString()]: "Expected Tweak",
      [exports.ERROR_BAD_HASH.toString()]: "Expected Hash",
      [exports.ERROR_BAD_SIGNATURE.toString()]: "Expected Signature",
      [exports.ERROR_BAD_EXTRA_DATA.toString()]: "Expected Extra Data (32 bytes)",
      [exports.ERROR_BAD_PARITY.toString()]: "Expected Parity (1 | 0)",
      [exports.ERROR_BAD_RECOVERY_ID.toString()]: "Bad Recovery Id"
    };
    function throwError(errcode) {
      const message = ERRORS_MESSAGES[errcode.toString()] || `Unknow error code: ${errcode}`;
      throw new TypeError(message);
    }
  }
});

// node_modules/bells-secp256k1/lib/validate.js
var require_validate = __commonJS({
  "node_modules/bells-secp256k1/lib/validate.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.SIGNATURE_SIZE = exports.EXTRA_DATA_SIZE = exports.HASH_SIZE = exports.TWEAK_SIZE = exports.X_ONLY_PUBLIC_KEY_SIZE = exports.PUBLIC_KEY_UNCOMPRESSED_SIZE = exports.PUBLIC_KEY_COMPRESSED_SIZE = exports.PRIVATE_KEY_SIZE = void 0;
    exports.isZero = isZero;
    exports.isPrivate = isPrivate;
    exports.isPoint = isPoint;
    exports.isXOnlyPoint = isXOnlyPoint;
    exports.isDERPoint = isDERPoint;
    exports.isPointCompressed = isPointCompressed;
    exports.validateParity = validateParity;
    exports.validatePrivate = validatePrivate;
    exports.validatePoint = validatePoint;
    exports.validateXOnlyPoint = validateXOnlyPoint;
    exports.validateTweak = validateTweak;
    exports.validateHash = validateHash;
    exports.validateExtraData = validateExtraData;
    exports.validateSignature = validateSignature;
    exports.validateSignatureCustom = validateSignatureCustom;
    exports.validateSignatureNonzeroRS = validateSignatureNonzeroRS;
    exports.validateSigrPMinusN = validateSigrPMinusN;
    var validate_error_js_1 = require_validate_error();
    exports.PRIVATE_KEY_SIZE = 32;
    exports.PUBLIC_KEY_COMPRESSED_SIZE = 33;
    exports.PUBLIC_KEY_UNCOMPRESSED_SIZE = 65;
    exports.X_ONLY_PUBLIC_KEY_SIZE = 32;
    exports.TWEAK_SIZE = 32;
    exports.HASH_SIZE = 32;
    exports.EXTRA_DATA_SIZE = 32;
    exports.SIGNATURE_SIZE = 64;
    var BN32_ZERO = new Uint8Array(32);
    var BN32_N = new Uint8Array([
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      255,
      254,
      186,
      174,
      220,
      230,
      175,
      72,
      160,
      59,
      191,
      210,
      94,
      140,
      208,
      54,
      65,
      65
    ]);
    var BN32_P_MINUS_N = new Uint8Array([
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      69,
      81,
      35,
      25,
      80,
      183,
      95,
      196,
      64,
      45,
      161,
      114,
      47,
      201,
      186,
      238
    ]);
    function isUint8Array(value) {
      return value instanceof Uint8Array;
    }
    function cmpBN32(data1, data2) {
      for (let i = 0; i < 32; ++i) {
        if (data1[i] !== data2[i]) {
          return data1[i] < data2[i] ? -1 : 1;
        }
      }
      return 0;
    }
    function isZero(x) {
      return cmpBN32(x, BN32_ZERO) === 0;
    }
    function isPrivate(x) {
      return isUint8Array(x) && x.length === exports.PRIVATE_KEY_SIZE && cmpBN32(x, BN32_ZERO) > 0 && cmpBN32(x, BN32_N) < 0;
    }
    function isPoint(p) {
      return isUint8Array(p) && (p.length === exports.PUBLIC_KEY_COMPRESSED_SIZE || p.length === exports.PUBLIC_KEY_UNCOMPRESSED_SIZE || p.length === exports.X_ONLY_PUBLIC_KEY_SIZE);
    }
    function isXOnlyPoint(p) {
      return isUint8Array(p) && p.length === exports.X_ONLY_PUBLIC_KEY_SIZE;
    }
    function isDERPoint(p) {
      return isUint8Array(p) && (p.length === exports.PUBLIC_KEY_COMPRESSED_SIZE || p.length === exports.PUBLIC_KEY_UNCOMPRESSED_SIZE);
    }
    function isPointCompressed(p) {
      return isUint8Array(p) && p.length === exports.PUBLIC_KEY_COMPRESSED_SIZE;
    }
    function isTweak(tweak) {
      return isUint8Array(tweak) && tweak.length === exports.TWEAK_SIZE && cmpBN32(tweak, BN32_N) < 0;
    }
    function isHash(h) {
      return isUint8Array(h) && h.length === exports.HASH_SIZE;
    }
    function isExtraData(e) {
      return e === void 0 || isUint8Array(e) && e.length === exports.EXTRA_DATA_SIZE;
    }
    function isSignature(signature) {
      return isUint8Array(signature) && signature.length === 64 && cmpBN32(signature.subarray(0, 32), BN32_N) < 0 && cmpBN32(signature.subarray(32, 64), BN32_N) < 0;
    }
    function isSigrLessThanPMinusN(signature) {
      return isUint8Array(signature) && signature.length === 64 && cmpBN32(signature.subarray(0, 32), BN32_P_MINUS_N) < 0;
    }
    function validateParity(p) {
      if (p !== 0 && p !== 1)
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_PARITY);
    }
    function validatePrivate(d) {
      if (!isPrivate(d))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_PRIVATE);
    }
    function validatePoint(p) {
      if (!isPoint(p))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_POINT);
    }
    function validateXOnlyPoint(p) {
      if (!isXOnlyPoint(p))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_POINT);
    }
    function validateTweak(tweak) {
      if (!isTweak(tweak))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_TWEAK);
    }
    function validateHash(h) {
      if (!isHash(h))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_HASH);
    }
    function validateExtraData(e) {
      if (!isExtraData(e))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_EXTRA_DATA);
    }
    function validateSignature(signature) {
      if (!isSignature(signature))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_SIGNATURE);
    }
    function validateSignatureCustom(validatorFn) {
      if (!validatorFn())
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_SIGNATURE);
    }
    function validateSignatureNonzeroRS(signature) {
      if (isZero(signature.subarray(0, 32)))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_SIGNATURE);
      if (isZero(signature.subarray(32, 64)))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_SIGNATURE);
    }
    function validateSigrPMinusN(signature) {
      if (!isSigrLessThanPMinusN(signature))
        (0, validate_error_js_1.throwError)(validate_error_js_1.ERROR_BAD_RECOVERY_ID);
    }
  }
});

// node_modules/base64-arraybuffer/dist/base64-arraybuffer.umd.js
var require_base64_arraybuffer_umd = __commonJS({
  "node_modules/base64-arraybuffer/dist/base64-arraybuffer.umd.js"(exports, module) {
    init_buffer_shim();
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global["base64-arraybuffer"] = {}));
    })(exports, (function(exports2) {
      "use strict";
      var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
      for (var i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
      }
      var encode = function(arraybuffer) {
        var bytes = new Uint8Array(arraybuffer), i2, len = bytes.length, base64 = "";
        for (i2 = 0; i2 < len; i2 += 3) {
          base64 += chars[bytes[i2] >> 2];
          base64 += chars[(bytes[i2] & 3) << 4 | bytes[i2 + 1] >> 4];
          base64 += chars[(bytes[i2 + 1] & 15) << 2 | bytes[i2 + 2] >> 6];
          base64 += chars[bytes[i2 + 2] & 63];
        }
        if (len % 3 === 2) {
          base64 = base64.substring(0, base64.length - 1) + "=";
        } else if (len % 3 === 1) {
          base64 = base64.substring(0, base64.length - 2) + "==";
        }
        return base64;
      };
      var decode = function(base64) {
        var bufferLength = base64.length * 0.75, len = base64.length, i2, p = 0, encoded1, encoded2, encoded3, encoded4;
        if (base64[base64.length - 1] === "=") {
          bufferLength--;
          if (base64[base64.length - 2] === "=") {
            bufferLength--;
          }
        }
        var arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
        for (i2 = 0; i2 < len; i2 += 4) {
          encoded1 = lookup[base64.charCodeAt(i2)];
          encoded2 = lookup[base64.charCodeAt(i2 + 1)];
          encoded3 = lookup[base64.charCodeAt(i2 + 2)];
          encoded4 = lookup[base64.charCodeAt(i2 + 3)];
          bytes[p++] = encoded1 << 2 | encoded2 >> 4;
          bytes[p++] = (encoded2 & 15) << 4 | encoded3 >> 2;
          bytes[p++] = (encoded3 & 3) << 6 | encoded4 & 63;
        }
        return arraybuffer;
      };
      exports2.decode = decode;
      exports2.encode = encode;
      Object.defineProperty(exports2, "__esModule", { value: true });
    }));
  }
});

// node_modules/bells-secp256k1/lib/wasm.js
var require_wasm = __commonJS({
  "node_modules/bells-secp256k1/lib/wasm.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var base64_arraybuffer_1 = require_base64_arraybuffer_umd();
    var wasm = "AGFzbQEAAAABZg9gAn9/AGACf38Bf2ADf39/AX9gA39/fwBgAAF/YAF/AX9gAX8AYAR/f39/AGAGf39/f39/AX9gBH9/f38Bf2AFf39/f38Bf2AAAGADfn9/AX9gCH9/f39/f39/AX9gBX9+fn5+AAI8AgkuL3JhbmQuanMNZ2VuZXJhdGVJbnQzMgAEEy4vdmFsaWRhdGVfZXJyb3IuanMKdGhyb3dFcnJvcgAGA0hHAQwKAQYGBAsFAgEEBQAFBAUBBAQLBgUGAQEECgADAAkBAgMACQADAAADBwEIAwAIAwAAAQUDAAAAAgEJAQ0CAwcHAwcBDgIEBQFwAQcHBQMBAAsGVQx/AUGAgCgLfwBBhJUqC38AQeCBKAt/AEGFlioLfwBBxZUqC38AQeWVKgt/AEHklCoLfwBBoYIoC38AQcGCKAt/AEGllioLfwBB7JYqC38AQfCWKgsH8QQiBm1lbW9yeQIAEWluaXRpYWxpemVDb250ZXh0AAkHaXNQb2ludAAKEFBVQkxJQ19LRVlfSU5QVVQDAQhwb2ludEFkZAALEVBVQkxJQ19LRVlfSU5QVVQyAwIOcG9pbnRBZGRTY2FsYXIADAtUV0VBS19JTlBVVAMDEnhPbmx5UG9pbnRBZGRUd2VhawANF1hfT05MWV9QVUJMSUNfS0VZX0lOUFVUAwQXeE9ubHlQb2ludEFkZFR3ZWFrQ2hlY2sADhhYX09OTFlfUFVCTElDX0tFWV9JTlBVVDIDBQ1wb2ludENvbXByZXNzAA8PcG9pbnRGcm9tU2NhbGFyABANUFJJVkFURV9JTlBVVAMGFHhPbmx5UG9pbnRGcm9tU2NhbGFyABETeE9ubHlQb2ludEZyb21Qb2ludAASDXBvaW50TXVsdGlwbHkAEwpwcml2YXRlQWRkABQKcHJpdmF0ZVN1YgAVDXByaXZhdGVOZWdhdGUAFgRzaWduABcKSEFTSF9JTlBVVAMHEEVYVFJBX0RBVEFfSU5QVVQDCA9TSUdOQVRVUkVfSU5QVVQDCQ9zaWduUmVjb3ZlcmFibGUAGAtzaWduU2Nobm9ycgAZBnZlcmlmeQAaB3JlY292ZXIAGw12ZXJpZnlTY2hub3JyABwucnVzdHNlY3AyNTZrMV92MF84XzFfZGVmYXVsdF9lcnJvcl9jYWxsYmFja19mbgAeMHJ1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QgyGIBNCNIiEIAApA7ABIhkgACkD8AF8IhQgACkDUHwiFSAAKQOgAnwiFnwhDyAAQRBqIgEgDyAWVK0gFSAWVq0gDEEIaikDACAUIBVWrSAJQQhqKQMAIBQgGVStIApBCGopAwAgC0EIaikDAHx8fHx8fCAYQjSIfHwiGEIMhiAPQjSIhCAAKQOgASIZIAApA9ABfCIUfCIVQgSGQvD/////////AIMgD0IwiEIPg4RCAELRh4CAEEIAEEcgACAAKQMQIhogACkDAHwiFkL/////////B4M3A7AEIABB8ABqIgMgF0IAIBFCABBHIABB4AFqIgggEEIAIBJCABBHIABBkAJqIgkgDkIAIA5CABBHIABBQGsiCiAUIBVWrSAUIBlUrSAEQQhqKQMAIA1BCGopAwB8fCAYQjSIfHwiGUIMhiAVQjSIhCAAKQPgASIbIAApA5ACfCIUfCIVQv////////8Hg0IAQpD6gICAAkIAEEcgACAWIBpUrSABQQhqKQMAIABBCGopAwB8fCIaQgyGIBZCNIiEIAApA0AiHCAAKQNwfCIWfCIYQv////////8HgzcDuAQgAEHgAGoiASAXQgAgEkIAEEcgAEGQAWoiBCARQgAgEUIAEEcgAEGAAmoiCyAQQgAgDkIAEEcgAEEwaiIMIBQgFVatIBQgG1StIAhBCGopAwAgCUEIaikDAHx8IBlCNIh8fCIQQgyGIBVCNIiEIhcgACkDgAJ8IhRCAEKQ+oCAgAJCABBHIAAgFiAYVq0gFiAcVK0gCkEIaikDACADQQhqKQMAfHwgGkI0iHx8IhVCDIYgGEI0iIQgACkDYCIWIAApA5ABfCIOIAApAzB8IhJ8IhFC/////////weDNwPABCAAQSBqIgMgFCAXVK0gC0EIaikDACAQQjSIfHxCAEKAgMSegIDAAEIAEEcgACARIBJUrSAOIBJWrSAMQQhqKQMAIA4gFlStIAFBCGopAwAgBEEIaikDAHx8fHwgFUI0iHx8IhBCDIYgEUI0iIQgACkDICIRIBNC/v///////weDfCIOfCISQv////////8HgzcDyAQgACAPQv///////z+DIA4gElatIANBCGopAwAgDiARVK18IBBCNIh8fEIMhiASQjSIhHw3A9AEQciAKEHIgCggAEGwBGoiARAkQfCAKEHwgCggARAkQfCAKEHwgCggAEGIBGoiAxAkQZiBKEGYgSggAxAkIAIgBRAwIABBsAVqIgIgBUEAEChCf0IAIAJBGGoiBCkDACISIAJBEGoiAykDACIPIAJBCGoiBSkDACIRIAApA7AFIhCEhIQiE0IAUhshDiAEIA4gEoMiEjcDACADIA4gD4MiDzcDACAFIA4gEYMiETcDACAAIBNQrSAOIBCDhCIQNwOwBUGggCggASACEDJBqIAoQn9CACAPIBGEIBKEIBCEQgBSGyIOIBBCf4UiEEK+/ab+sq7olsAAfSITgyIXNwMAIAUgECATVq0gEUJ/hSIQfCIRQsW/3YWV48ioxQB9IhMgDoMiFDcDAEGwgCggFDcDACADIBAgEVatIBEgE1atfCAPQn+FIhF8Ig9CAn0iECAOgyITNwMAQbiAKCATNwMAIAQgDyARVK0gDyAQVq18IBJ9QgJ9IA6DIg43AwBBwIAoIA43AwAgACAXNwOwBUHIgCggAUGAARBIGgsgAEHQBWokAEHFlCpCADcAAEHElCpBAToAAEHNlCpCADcAAEHVlCpCADcAAEHclCpCADcAACAGQQE2AgRB6JYqQaCAKDYCAAsgBkEgaiQAIAcLBQAQCBoL4gEBAX8jAEFAaiIBJAACfyAAQSBHBEAgAUE4akIANwMAIAFBMGpCADcDACABQShqQgA3AwAgAUEgakIANwMAIAFBGGpCADcDACABQRBqQgA3AwAgAUEIakIANwMAIAFCADcDAEHAlCooAgAgAUGElSogABAhDAELIAFBOGpCADcDACABQTBqQgA3AwAgAUEoakIANwMAIAFBIGpCADcDACABQRhqQgA3AwAgAUEQakIANwMAIAFBCGpCADcDACABQgA3AwBBwJQqKAIAIAFBhJUqEDsLIQAgAUFAayQAIABBAUYLrwwCGH8GfiMAQZACayIDJAAgA0HIAWoiBEE4aiIFQgA3AwAgBEEwaiIGQgA3AwAgBEEoaiIIQgA3AwAgBEEgaiIJQgA3AwAgBEEYaiIKQgA3AwAgBEEQaiIRQgA3AwAgBEEIaiISQgA3AwAgA0IANwPIAQJAAkBBwJQqKAIAIARBhJUqIAAQIUEBRgRAIANBQGsiAEEIaiIHIARBD2oiCykAADcDACAAQRBqIgwgBEEXaiINKQAANwMAIABBGGoiDiAEQR9qIg8pAAA3AwAgAEEgaiIQIARBJ2oiEykAADcDACAAQShqIhQgBEEvaiIVKQAANwMAIABBMGoiFiAEQTdqIhcpAAA3AwAgAEE4aiIYIARBP2oiGS0AADoAACADIAMtAMoBOgACIAMgAy8ByAE7AQAgAyADKQDPATcDQCADKADLASEaIANBP2ogGC0AADoAACADQTdqIBYpAwA3AAAgA0EvaiAUKQMANwAAIANBJ2ogECkDADcAACADQR9qIA4pAwA3AAAgA0EXaiAMKQMANwAAIANBD2ogBykDADcAACADIBo2AAMgAyADKQNANwAHIAVCADcDACAGQgA3AwAgCEIANwMAIAlCADcDACAKQgA3AwAgEUIANwMAIBJCADcDACADQgA3A8gBQQAhB0HAlCooAgAgBEHggSggARAhQQFGBEAgA0GAAWoiAUEIaiIHIAspAAA3AwAgAUEQaiILIA0pAAA3AwAgAUEYaiIMIA8pAAA3AwAgAUEgaiINIBMpAAA3AwAgAUEoaiIOIBUpAAA3AwAgAUEwaiIPIBcpAAA3AwAgAUE4aiIBIBktAAA6AAAgAyADLQDKAToAQiADIAMvAcgBOwFAIAMgAykAzwE3A4ABIAMoAMsBIRAgAEE/aiABLQAAOgAAIABBN2ogDykDADcAACAAQS9qIA4pAwA3AAAgAEEnaiANKQMANwAAIABBH2ogDCkDADcAACAAQRdqIAspAwA3AAAgAEEPaiAHKQMANwAAIAMgEDYAQyADIAMpA4ABNwBHIAVCADcDACAGQgA3AwAgCEIANwMAIAlCADcDACAKQgA3AwAgEUIANwMAIBJCADcDACADQgA3A8gBIAMgADYCxAEgAyADNgLAAUEAIQdBwJQqKAIAIQEgA0HAAWohBkECIQgjAEHgAWsiACQAAn8gBEUEQEHyjCogAUGsAWooAgAgAUGoAWooAgARAABBAAwBCyAEQgA3AAAgBEE4akIANwAAIARBMGpCADcAACAEQShqQgA3AAAgBEEgakIANwAAIARBGGpCADcAACAEQRBqQgA3AAAgBEEIakIANwAAIAZFBEBBkowqIAFBrAFqKAIAIAFBqAFqKAIAEQAAQQAMAQsgAEEBNgLYASAAQeAAakH4ABBGGiABQawBaiEKA0AgBigCACIFRQRAQZGNKiABQawBaigCACABKAKoAREAAEEADAILIABBADYCWCAAIAUpADgiG0IQiDcDUCAAIAUpACAiHEL/////////B4M3AzAgACAbQiSGQoCAgICA/v8HgyAFKQAwIhtCHIiENwNIIAAgG0IYhkKAgID4////B4MgBSkAKCIbQiiIhDcDQCAAIBtCDIZCgOD//////weDIBxCNIiENwM4IAAgBSkACCIbQgyGQoDg//////8HgyAFKQAAIhxCNIiEIh43AxAgACAcQv////////8HgyIcNwMIIAAgBSkAGCIdQhCIIh83AyggACAFKQAQIiBCGIZCgICA+P///weDIBtCKIiEIhs3AxggACAdQiSGQoCAgICA/v8HgyAgQhyIhCIdNwMgIBwgHoQgH4QgG4QgHYRQBEBBxI8qIAooAgAgASgCqAERAAALIAZBBGohBiAAQeAAaiIFIAUgAEEIaiIJEDcgCEEBayIIDQALQQAgACgC2AENABogCSAFEDMgBCAJECVBAQshASAAQeABaiQAIAFFDQMgAyACNgKIAiADQcCUKigCACADQYgCaiAEQYICQQIgAkEhRhsQJiIANgKMAiAAQQFHDQJBASEHDAMLQQEQAQwCC0EBEAEMAQsgA0EANgKIASADQYABahAHAAsgA0GQAmokACAHC+IKAgp/Bn4jAEHQAWsiAyQAIANBiAFqIgRBOGpCADcDACAEQTBqQgA3AwAgBEEoakIANwMAIARBIGpCADcDACAEQRhqQgA3AwAgBEEQakIANwMAIARBCGpCADcDACADQgA3A4gBAkBBwJQqKAIAIARBhJUqIAAQIUEBRgRAIANByABqIgBBCGoiAiAEQQ9qKQAANwMAIABBEGoiBSAEQRdqKQAANwMAIABBGGoiBiAEQR9qKQAANwMAIABBIGoiByAEQSdqKQAANwMAIABBKGoiCCAEQS9qKQAANwMAIABBMGoiCSAEQTdqKQAANwMAIABBOGoiCiAEQT9qLQAAOgAAIAMgAy0AigE6AAogAyADLwGIATsBCCADIAMpAI8BNwNIIAMoAIsBIQsgA0EIaiIAQT9qIAotAAA6AAAgAEE3aiAJKQMANwAAIABBL2ogCCkDADcAACAAQSdqIAcpAwA3AAAgAEEfaiAGKQMANwAAIABBF2ogBSkDADcAACAAQQ9qIAIpAwA3AAAgAyALNgALIAMgAykDSDcAD0EAIQcQCCEFQQAhCCMAQaACayICJAACQCAARQRAQeaLKiAFQawBaigCACAFQagBaigCABEAAAwBCyACQcgAaiAAKQA4IgxCEIg3AwAgAkFAayAMQiSGQoCAgICA/v8HgyAAKQAwIgxCHIiENwMAIAJBOGogDEIYhkKAgID4////B4MgACkAKCIMQiiIhDcDACACQTBqIAxCDIZCgOD//////weDIAApACAiDEI0iIQ3AwAgAkEANgJQIAIgDEL/////////B4M3AyggAiAAKQAIIgxCDIZCgOD//////weDIAApAAAiDUI0iIQiDzcDCCACIA1C/////////weDIg03AwAgAiAAKQAYIg5CEIgiEDcDICACIAApABAiEUIYhkKAgID4////B4MgDEIoiIQiDDcDECACIA5CJIZCgICAgID+/weDIBFCHIiEIg43AxggDSAPhCAQhCAMhCAOhFAEQEHEjyogBUGsAWooAgAgBUGoAWooAgARAAAgAEE4akIANwAAIABBMGpCADcAACAAQShqQgA3AAAgAEEgakIANwAAIABBGGpCADcAACAAQRBqQgA3AAAgAEEIakIANwAAIABCADcAAAwBCyAAQgA3AAAgAEE4akIANwAAIABBMGpCADcAACAAQShqQgA3AAAgAEEgakIANwAAIABBGGpCADcAACAAQRBqQgA3AAAgAEEIakIANwAAIAJBADYCXCACQeAAaiIJQYWWKiACQdwAahAoIAIoAlwNACACQaABaiIFQQhqIAJBCGopAwA3AwAgBUEQaiACQRBqKQMANwMAIAVBGGogAkEYaikDADcDACAFQSBqIAJBIGopAwA3AwAgAkHQAWogAkEoaiIGQQhqKQMANwMAIAJB2AFqIAZBEGopAwA3AwAgAkHgAWogBkEYaikDADcDACACQegBaiAGQSBqKQMANwMAIAJBADYCmAIgAiACKQMANwOgASACIAYpAwA3A8gBIAJB+AFqQgA3AwAgAkGAAmpCADcDACACQYgCakIANwMAIAJBkAJqQgA3AwAgAkGAAWoiBkEQakIANwMAIAZBGGpCADcDACACQgE3A/ABIAJCADcDiAEgAkIBNwOAASAFIAUgBiAJECwgAigCmAINACACIAUQMyAAIAIQJUEBIQgLIAJBoAJqJAAgCEUNASADIAE2AswBIANBwJQqKAIAIANBzAFqIABBggJBAiABQSFGGxAmIgA2AkhBASEHIABBAUYNASADQQA2ApABIAQQBwALQQEQAQsgA0HQAWokACAHC5cLAhJ/Bn4jAEHQAWsiAyQAIANBiAFqIgFBOGoiAEIANwMAIAFBMGoiBEIANwMAIAFBKGoiBUIANwMAIAFBIGoiBkIANwMAIAFBGGoiB0IANwMAIAFBEGoiCEIANwMAIAFBCGoiCUIANwMAIANCADcDiAECQAJAQcCUKigCACABQcWVKhA7QQFGBEAgA0HIAGoiAkEIaiIKIAFBD2opAAA3AwAgAkEQaiILIAFBF2opAAA3AwAgAkEYaiIMIAFBH2opAAA3AwAgAkEgaiINIAFBJ2opAAA3AwAgAkEoaiIOIAFBL2opAAA3AwAgAkEwaiIPIAFBN2opAAA3AwAgAkE4aiIQIAFBP2otAAA6AAAgAyADLQCKAToACiADIAMvAYgBOwEIIAMgAykAjwE3A0ggAygAiwEhESADQQhqIgJBP2ogEC0AADoAACACQTdqIA8pAwA3AAAgAkEvaiAOKQMANwAAIAJBJ2ogDSkDADcAACACQR9qIAwpAwA3AAAgAkEXaiALKQMANwAAIAJBD2ogCikDADcAACADIBE2AAsgAyADKQNINwAPIABCADcDACAEQgA3AwAgBUIANwMAIAZCADcDACAHQgA3AwAgCEIANwMAIAlCADcDACADQgA3A4gBEAghBEEAIQYjAEGgAmsiACQAAkAgAUUEQEHHiyogBEGsAWooAgAgBEGoAWooAgARAAAMAQsgAUIANwAAIAFBOGpCADcAACABQTBqQgA3AAAgAUEoakIANwAAIAFBIGpCADcAACABQRhqQgA3AAAgAUEQakIANwAAIAFBCGpCADcAACACRQRAQd2LKiAEQawBaigCACAEQagBaigCABEAAAwBCyAAQcgAaiACKQA4IhJCEIg3AwAgAEFAayASQiSGQoCAgICA/v8HgyACKQAwIhJCHIiENwMAIABBOGogEkIYhkKAgID4////B4MgAikAKCISQiiIhDcDACAAQTBqIBJCDIZCgOD//////weDIAIpACAiEkI0iIQ3AwAgAEEANgJQIAAgEkL/////////B4M3AyggACACKQAIIhJCDIZCgOD//////weDIAIpAAAiE0I0iIQiFTcDCCAAIBNC/////////weDIhM3AwAgACACKQAYIhRCEIgiFjcDICAAIAIpABAiF0IYhkKAgID4////B4MgEkIoiIQiEjcDECAAIBRCJIZCgICAgID+/weDIBdCHIiEIhQ3AxggEyAVhCAWhCAShCAUhFAEQEHEjyogBEGsAWooAgAgBEGoAWooAgARAAAMAQsgAEEANgJcIABB4ABqIgdBhZYqIABB3ABqECggACgCXA0AIABBoAFqIgRBCGogAEEIaikDADcDACAEQRBqIABBEGopAwA3AwAgBEEYaiAAQRhqKQMANwMAIARBIGogAEEgaikDADcDACAAQdABaiAAQShqIgVBCGopAwA3AwAgAEHYAWogBUEQaikDADcDACAAQeABaiAFQRhqKQMANwMAIABB6AFqIAVBIGopAwA3AwAgAEEANgKYAiAAIAApAwA3A6ABIAAgBSkDADcDyAEgAEH4AWpCADcDACAAQYACakIANwMAIABBiAJqQgA3AwAgAEGQAmpCADcDACAAQYABaiIFQRBqQgA3AwAgBUEYakIANwMAIABCATcD8AEgAEIANwOIASAAQgE3A4ABIAQgBCAFIAcQLCAAKAKYAg0AIAAgBBAzIAEgABAlQQEhBgsgAEGgAmokACAGBEAgA0EANgKEASADEAggAiADQYQBaiABED0iATYCzAEgAUEBRw0DIANBwJQqKAIAIAIQPCIBNgLMASABQQFHDQMgAygChAEhAgwCC0F/IQIMAQtBARABCyADQdABaiQAIAIPCyADQQA2AlAgA0HIAGoQBwALihICEX8IfiMAQcABayICJAAgAkGAAWoiBEE4aiIIQgA3AwAgBEEwaiIJQgA3AwAgBEEoaiIKQgA3AwAgBEEgaiILQgA3AwAgBEEYaiIMQgA3AwAgBEEQaiINQgA3AwAgBEEIaiIOQgA3AwAgAkIANwOAAQJAQcCUKigCACAEQcWVKhA7QQFGBEAgAkFAayIDQQhqIg8gBEEPaikAADcDACADQRBqIhAgBEEXaikAADcDACADQRhqIhEgBEEfaikAADcDACADQSBqIgEgBEEnaikAADcDACADQShqIgYgBEEvaikAADcDACADQTBqIgUgBEE3aikAADcDACADQThqIgcgBEE/ai0AADoAACACIAItAIIBOgACIAIgAi8BgAE7AQAgAiACKQCHATcDQCACKACDASEDIAJBP2ogBy0AADoAACACQTdqIAUpAwA3AAAgAkEvaiAGKQMANwAAIAJBJ2ogASkDADcAACACQR9qIBEpAwA3AAAgAkEXaiAQKQMANwAAIAJBD2ogDykDADcAACACIAM2AAMgAiACKQNANwAHIAhCADcDACAJQgA3AwAgCkIANwMAIAtCADcDACAMQgA3AwAgDUIANwMAIA5CADcDACACQgA3A4ABQQAhA0HAlCooAgAgBEHllSoQO0EBRgRAEAghAyMAQaACayIBJAACQCACRQRAQd2LKiADQawBaigCACADQagBaigCABEAAEEAIQMMAQsgAUHIAGogAikAOCISQhCINwMAIAFBQGsgEkIkhkKAgICAgP7/B4MgAikAMCISQhyIhDcDACABQThqIBJCGIZCgICA+P///weDIAIpACgiEkIoiIQ3AwAgAUEwaiASQgyGQoDg//////8HgyACKQAgIhJCNIiENwMAIAEgEkL/////////B4M3AyggASACKQAIIhNCDIZCgOD//////weDIAIpAAAiEkI0iIQiFTcDCCABIBJC/////////weDIhg3AwAgASACKQAYIhlCEIgiFDcDICABIAIpABAiEkIYhkKAgID4////B4MgE0IoiIQiEzcDECABIBlCJIZCgICAgID+/weDIBJCHIiEIhI3AxggFSAYhCAUhCAThCAShFAEQEHEjyogA0GsAWooAgAgA0GoAWooAgARAABBACEDDAELQQAhAyABQQA2AlwgAUHgAGoiB0GFliogAUHcAGoQKCABKAJcDQAgAUGgAWoiBkEIaiABQQhqKQMANwMAIAZBEGogAUEQaikDADcDACAGQRhqIAFBGGopAwA3AwAgBkEgaiABQSBqKQMANwMAIAFB0AFqIAFBKGoiBUEIaikDADcDACABQdgBaiAFQRBqKQMANwMAIAFB4AFqIAVBGGopAwA3AwAgAUHoAWogBUEgaikDADcDACABQQA2ApgCIAEgASkDADcDoAEgASAFKQMANwPIASABQfgBakIANwMAIAFBgAJqQgA3AwAgAUGIAmpCADcDACABQZACakIANwMAIAFBgAFqIgVBEGpCADcDACAFQRhqQgA3AwAgAUIBNwPwASABQgA3A4gBIAFCATcDgAEgBiAGIAUgBxAsIAEoApgCDQAgASAGEDMgASkDCCABKQMAIAEpAyAiFEIwiELRh4CAEH58IhNCNIh8IhhC/////////weDIRYgASkDGCABKQMQIBhCNIh8IhJCNIh8IhlC/////////weDIRcgGCASQv////////8HgyIVgyAZg0L/////////B1EgFEL///////8/gyAZQjSIfCIUQv///////z9RcSATQv////////8HgyITQq74///v//8HVnGtIBRCMIiEpwRAIBNC0YeAgBB8IhJC/////////weDIRMgFiASQjSIfCISQv////////8HgyEWIBUgEkI0iHwiEkL/////////B4MhFSAXIBJCNIh8IhJC/////////weDIRcgEkI0iCAUfEL///////8/gyEUC0HllSotAAAgFEIoiKdB/wFxRw0AQeaVKi0AACAUQiCIp0H/AXFHDQBB55UqLQAAIBRCGIinQf8BcUcNAEHolSotAAAgFEIQiKdB/wFxRw0AQemVKi0AACAUQgiIp0H/AXFHDQBB6pUqLQAAIBSnQf8BcUcNAEHrlSotAAAgF0IsiKdHDQBB7JUqLQAAIBdCJIinQf8BcUcNAEHtlSotAAAgF0IciKdB/wFxRw0AQe6VKi0AACAXQhSIp0H/AXFHDQBB75UqLQAAIBdCDIinQf8BcUcNAEHwlSotAAAgF0IEiKdB/wFxRw0AQfGVKi0AACAXQgSGIBVCMIiEp0H/AXFHDQBB8pUqLQAAIBVCKIinQf8BcUcNAEHzlSotAAAgFUIgiKdB/wFxRw0AQfSVKi0AACAVQhiIp0H/AXFHDQBB9ZUqLQAAIBVCEIinQf8BcUcNAEH2lSotAAAgFUIIiKdB/wFxRw0AQfeVKi0AACAVp0H/AXFHDQBB+JUqLQAAIBZCLIinRw0AQfmVKi0AACAWQiSIp0H/AXFHDQBB+pUqLQAAIBZCHIinQf8BcUcNAEH7lSotAAAgFkIUiKdB/wFxRw0AQfyVKi0AACAWQgyIp0H/AXFHDQBB/ZUqLQAAIBZCBIinQf8BcUcNAEH+lSotAAAgFkIEhiATQjCIhKdB/wFxRw0AQf+VKi0AACATQiiIp0H/AXFHDQBBgJYqLQAAIBNCIIinQf8BcUcNAEGBliotAAAgE0IYiKdB/wFxRw0AQYKWKi0AACATQhCIp0H/AXFHDQBBg5YqLQAAIBNCCIinQf8BcUcNAEGEliotAAAgE6dB/wFxRw0AIAEpA0AgASkDOCABKQMwIAEpAyggASkDSCIUQjCIQtGHgIAQfnwiGEI0iHwiE0I0iHwiEkI0iHwhGSAZIBIgE4ODQv////////8Hg0L/////////B1EgFEL///////8/gyAZQjSIfCISQv///////z9RcSAYQv////////8Hg0Ku+P//7///B1ZxrSASQjCIhCAYfKdBAXEgAEYhAwsgAUGgAmokAAwCC0EBEAEMAQtBARABCyACQcABaiQAIAML5QMBC38jAEHQAWsiAiQAIAJBiAFqIgNBOGpCADcDACADQTBqQgA3AwAgA0EoakIANwMAIANBIGpCADcDACADQRhqQgA3AwAgA0EQakIANwMAIANBCGpCADcDACACQgA3A4gBAkBBwJQqKAIAIANBhJUqIAAQIUEBRgRAIAJByABqIgBBCGoiBSADQQ9qKQAANwMAIABBEGoiBiADQRdqKQAANwMAIABBGGoiByADQR9qKQAANwMAIABBIGoiCCADQSdqKQAANwMAIABBKGoiCSADQS9qKQAANwMAIABBMGoiCiADQTdqKQAANwMAIABBOGoiCyADQT9qLQAAOgAAIAIgAi0AigE6AAogAiACLwGIATsBCCACIAIpAI8BNwNIIAIoAIsBIQwgAkEIaiIEQT9qIAstAAA6AAAgBEE3aiAKKQMANwAAIARBL2ogCSkDADcAACAEQSdqIAgpAwA3AAAgBEEfaiAHKQMANwAAIARBF2ogBikDADcAACAEQQ9qIAUpAwA3AAAgAiAMNgALIAIgAikDSDcADyACIAE2AswBIAJBwJQqKAIAIAJBzAFqIARBggJBAiABQSFGGxAmIgE2AkggAUEBRg0BIAJBADYCkAEgAxAHAAtBARABCyACQdABaiQAC8gKAgh/BX4jAEHgAGsiASQAIAFBOGpCADcDACABQTBqQgA3AwAgAUEoakIANwMAIAFBIGpCADcDACABQRhqQgA3AwAgAUEQakIANwMAIAFBCGpCADcDACABQgA3AwAQCCEEIwBBgAJrIgMkAAJ/IAFFBEBB5osqIARBrAFqKAIAIARBqAFqKAIAEQAAQQAMAQsgAUIANwAAIAFBOGpCADcAACABQTBqQgA3AAAgAUEoakIANwAAIAFBIGpCADcAACABQRhqQgA3AAAgAUEQakIANwAAIAFBCGpCADcAACAEKAIARQRAQf2OKiAEQawBaigCACAEQagBaigCABEAAEEADAELIANBCGoiAkHklCogA0GAAWoiBRAoQgBCfyADKAKAASADKQMgIg0gAykDGCIMIAMpAxAiCiADKQMIIguEhIRQciIGGyEJIAMgCSANgzcDICADIAkgDIM3AxggAyAJIAqDNwMQIAMgBkEARyIIrSAJIAuDhDcDCCAEIAUgAhAyIANBKGoiAiAFEDMgASACECUgAyAINgKAASABIAMoAoABQQFrIgIgAS0AAHE6AAAgASABLQABIAJxOgABIAEgAS0AAiACcToAAiABIAEtAAMgAnE6AAMgASABLQAEIAJxOgAEIAEgAS0ABSACcToABSABIAEtAAYgAnE6AAYgASABLQAHIAJxOgAHIAEgAS0ACCACcToACCABIAEtAAkgAnE6AAkgASABLQAKIAJxOgAKIAEgAS0ACyACcToACyABIAEtAAwgAnE6AAwgASABLQANIAJxOgANIAEgAS0ADiACcToADiABIAEtAA8gAnE6AA8gASABLQAQIAJxOgAQIAEgAS0AESACcToAESABIAEtABIgAnE6ABIgASABLQATIAJxOgATIAEgAS0AFCACcToAFCABIAEtABUgAnE6ABUgASABLQAWIAJxOgAWIAEgAS0AFyACcToAFyABIAEtABggAnE6ABggASABLQAZIAJxOgAZIAEgAS0AGiACcToAGiABIAEtABsgAnE6ABsgASABLQAcIAJxOgAcIAEgAS0AHSACcToAHSABIAEtAB4gAnE6AB4gASABLQAfIAJxOgAfIAEgAS0AICACcToAICABIAEtACEgAnE6ACEgASABLQAiIAJxOgAiIAEgAS0AIyACcToAIyABIAEtACQgAnE6ACQgASABLQAlIAJxOgAlIAEgAS0AJiACcToAJiABIAEtACcgAnE6ACcgASABLQAoIAJxOgAoIAEgAS0AKSACcToAKSABIAEtACogAnE6ACogASABLQArIAJxOgArIAEgAS0ALCACcToALCABIAEtAC0gAnE6AC0gASABLQAuIAJxOgAuIAEgAS0ALyACcToALyABIAEtADAgAnE6ADAgASABLQAxIAJxOgAxIAEgAS0AMiACcToAMiABIAEtADMgAnE6ADMgASABLQA0IAJxOgA0IAEgAS0ANSACcToANSABIAEtADYgAnE6ADYgASABLQA3IAJxOgA3IAEgAS0AOCACcToAOCABIAEtADkgAnE6ADkgASABLQA6IAJxOgA6IAEgAS0AOyACcToAOyABIAEtADwgAnE6ADwgASABLQA9IAJxOgA9IAEgAS0APiACcToAPiABIAEtAD8gAnE6AD8gBkULIQIgA0GAAmokAAJAIAIEQCABIAA2AkAgAUHAlCooAgAgAUFAayABQYICQQIgAEEhRhsQJiIANgJEIABBAUcNAUEBIQcLIAFB4ABqJAAgBw8LIAFBADYCUCABQcgAahAHAAu+BwIIfwx+IwBBsAJrIgAkACAAQcgBaiIDQeAAEEYaAkACQBAIIAMQPkEBRgRAIAAgAC0AygE6AAogACAALwHIATsBCCAAKADLASEBIABB6ABqIgYgA0EHckHZABBIGiAAQQhqIgJBB3IgBkHZABBIGiAAIAE2AAsgAEGAAmpCADcDACAAQfgBakIANwMAIABB8AFqQgA3AwAgAEHoAWpCADcDACAAQeABakIANwMAIABB2AFqQgA3AwAgAEHQAWpCADcDACAAQgA3A8gBIABBADYCxAEQCCEEIABBxAFqIQcjAEHgAGsiASQAAn8gA0UEQEHmiyogBEGsAWooAgAgBEGoAWooAgARAABBAAwBCyADQgA3AAAgA0E4akIANwAAIANBMGpCADcAACADQShqQgA3AAAgA0EgakIANwAAIANBGGpCADcAACADQRBqQgA3AAAgA0EIakIANwAAIAJFBEBBpIwqIARBrAFqKAIAIARBqAFqKAIAEQAAQQAMAQsgAUHQAGogAikAWCIIQhCIIgw3AwAgAUHIAGogCEIkhkKAgICAgP7/B4MgAikAUCIIQhyIhCINNwMAIAFBCGoiBUE4aiAIQhiGQoCAgPj///8HgyACKQBIIghCKIiEIg43AwAgBUEwaiAIQgyGQoDg//////8HgyACKQBAIghCNIiEIg83AwBBACEFIAFBADYCWCABIAhC/////////weDIhA3AzAgASACKQAoIglCDIZCgOD//////weDIAIpACAiCkI0iIQiETcDECABIApC/////////weDIgo3AwggASACKQA4IgtCEIgiEjcDKCABIAIpADAiE0IYhkKAgID4////B4MgCUIoiIQiCTcDGCABIAtCJIZCgICAgID+/weDIBNCHIiEIgs3AyAgCiARhCAShCAJhCALhFAEQEHEjyogBEGsAWooAgAgBEGoAWooAgARAABBAAwBCyAIQgGDpwRAIAFC/P///////wEgDH03A1AgAUL8////////HyANfTcDSCABQvz///////8fIA59NwNAIAFC/P///////x8gD303AzggAUK84f//v///HyAQfTcDMEEBIQULIAcEQCAHIAU2AgALIAMgAUEIahAlQQELIQIgAUHgAGokACAAIAI2AqwCIAJBAUYNASAAQQA2AnAgBhAHAAtBABABDAELIABBwJQqKAIAIABByAFqEDwiAjYCrAJBASEBIAJBAUYNACAAQQA2AnAgAEHoAGoQBwALIABBsAJqJAAgAQufBwEYfyMAQZACayIBJAAgAUEIaiIDQThqIgRCADcDACADQTBqIgVCADcDACADQShqIgZCADcDACADQSBqIgdCADcDACADQRhqIghCADcDACADQRBqIglCADcDACADQQhqIgpCADcDACABQgA3AwggAUEANgJMIAFB0AFqIgJBOGoiC0IANwMAIAJBMGoiDEIANwMAIAJBKGoiDUIANwMAIAJBIGoiDkIANwMAIAJBGGoiD0IANwMAIAJBEGoiEEIANwMAIAJBCGoiEUIANwMAIAFCADcD0AECQAJAAkBBwJQqKAIAIAJBhJUqIAAQIUEBRgRAIAFBkAFqIgBBCGoiEiACQQ9qKQAANwMAIABBEGoiEyACQRdqKQAANwMAIABBGGoiFCACQR9qKQAANwMAIABBIGoiFSACQSdqKQAANwMAIABBKGoiFiACQS9qKQAANwMAIABBMGoiFyACQTdqKQAANwMAIABBOGoiGCACQT9qLQAAOgAAIAEgAS0A0gE6AFIgASABLwHQATsBUCABIAEpANcBNwOQASABKADTASECIAFB0ABqIgBBP2ogGC0AADoAACAAQTdqIBcpAwA3AAAgAEEvaiAWKQMANwAAIABBJ2ogFSkDADcAACAAQR9qIBQpAwA3AAAgAEEXaiATKQMANwAAIABBD2ogEikDADcAACABIAI2AFMgASABKQOQATcAVyABEAggAyABQcwAaiAAED0iADYCkAEgAEEBRw0CIBEgCikDADcDACAQIAkpAwA3AwAgDyAIKQMANwMAIA4gBykDADcDACANIAYpAwA3AwAgDCAFKQMANwMAIAsgBCkDADcDAAwBC0EBEAEgCyAEKQMANwMAIAwgBSkDADcDACANIAYpAwA3AwAgDiAHKQMANwMAIA8gCCkDADcDACAQIAkpAwA3AwAgESAKKQMANwMACyABIAEpAwg3A9ABIAFB0ABqIgBBOGogAUHQAWoiAkE4aikDADcDACAAQTBqIAJBMGopAwA3AwAgAEEoaiACQShqKQMANwMAIABBIGogAkEgaikDADcDACAAQRhqIAJBGGopAwA3AwAgAEEQaiACQRBqKQMANwMAIABBCGogAkEIaikDADcDACABIAEpA9ABNwNQIAFBwJQqKAIAIAAQPCIANgIIIABBAUcNASABQZACaiQAQQEPCyABQQA2AtgBIAFB0AFqEAcACyABQQA2AtgBIAFB0AFqEAcAC9ALAgp/Bn4jAEHQAWsiAyQAIANBiAFqIgRBOGpCADcDACAEQTBqQgA3AwAgBEEoakIANwMAIARBIGpCADcDACAEQRhqQgA3AwAgBEEQakIANwMAIARBCGpCADcDACADQgA3A4gBAkBBwJQqKAIAIARBhJUqIAAQIUEBRgRAIANByABqIgBBCGoiAiAEQQ9qKQAANwMAIABBEGoiBSAEQRdqKQAANwMAIABBGGoiBiAEQR9qKQAANwMAIABBIGoiByAEQSdqKQAANwMAIABBKGoiCCAEQS9qKQAANwMAIABBMGoiCSAEQTdqKQAANwMAIABBOGoiCiAEQT9qLQAAOgAAIAMgAy0AigE6AAogAyADLwGIATsBCCADIAMpAI8BNwNIIAMoAIsBIQsgA0EIaiIAQT9qIAotAAA6AAAgAEE3aiAJKQMANwAAIABBL2ogCCkDADcAACAAQSdqIAcpAwA3AAAgAEEfaiAGKQMANwAAIABBF2ogBSkDADcAACAAQQ9qIAIpAwA3AAAgAyALNgALIAMgAykDSDcAD0EAIQkQCCEFQQAhBiMAQaACayICJAAgAkEANgIEAkAgAEUEQEHmiyogBUGsAWooAgAgBUGoAWooAgARAAAMAQsgAkEIakGFliogAkEEahAoIAIoAgQEQCAAQgA3AAAgAEE4akIANwAAIABBMGpCADcAACAAQShqQgA3AAAgAEEgakIANwAAIABBGGpCADcAACAAQRBqQgA3AAAgAEEIakIANwAADAELIAJB8ABqIAApADgiDEIQiDcDACACQegAaiAMQiSGQoCAgICA/v8HgyAAKQAwIgxCHIiENwMAIAJBKGoiB0E4aiAMQhiGQoCAgPj///8HgyAAKQAoIgxCKIiENwMAIAdBMGogDEIMhkKA4P//////B4MgACkAICIMQjSIhDcDACACQQA2AnggAiAMQv////////8HgzcDUCACIAApAAgiDEIMhkKA4P//////B4MgACkAACINQjSIhCIPNwMwIAIgDUL/////////B4MiDTcDKCACIAApABgiDkIQiCIQNwNIIAIgACkAECIRQhiGQoCAgPj///8HgyAMQiiIhCIMNwM4IAIgDkIkhkKAgICAgP7/B4MgEUIciIQiDjcDQCANIA+EIBCEIAyEIA6EUARAQcSPKiAFQawBaigCACAFQagBaigCABEAACAAQThqQgA3AAAgAEEwakIANwAAIABBKGpCADcAACAAQSBqQgA3AAAgAEEYakIANwAAIABBEGpCADcAACAAQQhqQgA3AAAgAEIANwAADAELIABCADcAACAAQThqQgA3AAAgAEEwakIANwAAIABBKGpCADcAACAAQSBqQgA3AAAgAEEYakIANwAAIABBEGpCADcAACAAQQhqQgA3AAAgAikDICACKQMYIAIpAxAgAikDCISEhFANACACQYACaiIIQRhqQgA3AwAgCEEQakIANwMAIAhBCGpCADcDACACQYABaiIFQQhqIAJBKGoiBkEIaikDADcDACAFQRBqIAZBEGopAwA3AwAgBUEYaiAGQRhqKQMANwMAIAVBIGogBkEgaikDADcDACACQbABaiAGQShqIgdBCGopAwA3AwAgAkG4AWogB0EQaikDADcDACACQcABaiAHQRhqKQMANwMAIAJByAFqIAdBIGopAwA3AwAgAkIANwOAAiACQQA2AvgBIAIgAikDKDcDgAEgAiAHKQMANwOoASACQfABakIANwMAIAJB6AFqQgA3AwAgAkHgAWpCADcDACACQdgBakIANwMAIAJCATcD0AEgBSAFIAJBCGogCBAsIAYgBRAzIAAgBhAlQQEhBgsgAkGgAmokACAGRQ0BIAMgATYCzAEgA0HAlCooAgAgA0HMAWogAEGCAkECIAFBIUYbECYiADYCSEEBIQkgAEEBRg0BIANBADYCkAEgBBAHAAtBARABCyADQdABaiQAIAkLDgBBwJQqKAIAEDZBAUYLUAECfyMAQSBrIgAkACAAQcCUKigCAEGFlioQNSIBNgIEIAFBAUYEQEHAlCooAgAQNiEBIABBIGokACABQQFGDwsgAEEANgIQIABBCGoQBwALQAECfyMAQSBrIgAkACAAQcCUKigCAEHklCoQNSIBNgIEIAFBAUYEQCAAQSBqJAAPCyAAQQA2AhAgAEEIahAHAAvsBAEEfyMAQeAAayIBJAAgAUE4akIANwMAIAFBMGpCADcDACABQShqQgA3AwAgAUEgakIANwMAIAFBGGpCADcDACABQRBqQgA3AwAgAUEIakIANwMAIAFCADcDABAIIQJBwJAqKAIAIQNBwYIoQQAgABshACMAQUBqIgQkAAJAIAIoAgBFBEBB/Y4qIAJBrAFqKAIAIAJBqAFqKAIAEQAAQQAhAAwBCyABRQRAQeCMKiACQawBaigCACACQagBaigCABEAAEEAIQAMAQsgAiAEQSBqIgIgBEEAIAMgABAxIQAgAUEYaiACQRhqKQMANwAAIAFBEGogAkEQaikDADcAACABQQhqIAJBCGopAwA3AAAgASAEKQMgNwAAIAEgBCkDADcAICABQShqIARBCGopAwA3AAAgAUEwaiAEQRBqKQMANwAAIAFBOGogBEEYaikDADcAAAsgBEFAayQAIAEgADYCRAJAAkAgAEEBRgRAIAEhAEHAlCooAgAhAyMAQUBqIgIkAAJ/IAFFBEBB1IwqIANBrAFqKAIAIANBqAFqKAIAEQAAQQAMAQsgAkEgaiIDQRhqIAFBGGopAAA3AwAgA0EQaiABQRBqKQAANwMAIANBCGogAUEIaikAADcDACACQQhqIAFBKGopAAA3AwAgAkEQaiABQTBqKQAANwMAIAJBGGogAUE4aikAADcDACACIAEpAAA3AyAgAiABKQAgNwMAQaWWKiADEClBxZYqIAIQKUEBCyEDIAJBQGskACAAIAM2AkQgA0EBRg0BDAILDAELIAFB4ABqJAAPCyABQQA2AlAgAUHIAGoQBwAL9gQCBn8FfiMAQfAAayIEJAAgBEEQaiIBQcEAEEYaEAghAkHAkCooAgAhA0HBgihBACAAGyEAIwBB0ABrIgUkAAJAIAIoAgBFBEBB/Y4qIAJBrAFqKAIAIAJBqAFqKAIAEQAAQQAhAAwBCyABRQRAQeCMKiACQawBaigCACACQagBaigCABEAAEEAIQAMAQsgAiAFQTBqIgYgBUEQaiICIAVBDGogAyAAEDEhACABIAUpAzA3AAAgAUEIaiAGQQhqKQMANwAAIAFBEGogBkEQaikDADcAACABQRhqIAZBGGopAwA3AAAgASAFKQMQNwAgIAFBKGogAkEIaikDADcAACABQTBqIAJBEGopAwA3AAAgAUE4aiACQRhqKQMANwAAIAEgBSgCDDoAQAsgBUHQAGokACAEIAA2AlQgAEEBRgRAIARBADYCDEHAlCooAgAhAyAEQQxqIQAjAEFAaiICJAACQCABRQRAQdSMKiADQawBaigCACADQagBaigCABEAAAwBCyAARQRAQYONKiADQawBaigCACADQagBaigCABEAAAwBCyACQSBqIgNBGGogAUEYaikAADcDACADQRBqIAFBEGopAAA3AwAgA0EIaiABQQhqKQAANwMAIAFBOGopAAAhByABQTBqKQAAIQggAUEoaikAACEJIAEpACAhCiABKQAAIQsgACABLQBANgIAIAJBCGogCTcDACACQRBqIAg3AwAgAkEYaiAHNwMAIAIgCzcDICACIAo3AwBBpZYqIAMQKUHFliogAhApCyACQUBrJAAgBCgCDCEAIARB8ABqJAAgAA8LIARBADYCYCAEQdgAahAHAAujIQIHfwt+IwBBgAFrIgQkACAEQeAAEEYiBBAIIAQQPiIBNgJkAkACQCABQQFGBEAQCCEBQcGCKEEAIAAbIQcjAEGABWsiACQAIABB2ABqQgA3AwAgAEHQAGpCADcDACAAQgA3A0ggAEIANwNAAkAgASgCAEUEQEH9jiogAUGsAWooAgAgAUGoAWooAgARAAAMAQsgBEUEQEGkjCogAUGsAWooAgAgAUGoAWooAgARAAAMAQsgAEHYA2ohAyMAQRBrIgYkACAEKQAoIQkgBCkAMCEIIAQpAEghDCAEKQBQIQogBCkAICELIAQpADghDSAEKQBAIQ8gBCkAWCEQIABBwAFqIgJBADYCUCACQcgAaiAQQhCINwMAIAIgD0L/////////B4M3AyggAiANQhCIIhE3AyAgAiALQv////////8HgyIONwMAIAJBQGsgEEIkhkKAgICAgP7/B4MgCkIciIQ3AwAgAkE4aiAKQhiGQoCAgPj///8HgyAMQiiIhDcDACACQTBqIAxCDIZCgOD//////weDIA9CNIiENwMAIAIgDUIkhkKAgICAgP7/B4MgCEIciIQiDDcDGCACIAhCGIZCgICA+P///weDIAlCKIiEIgg3AxAgAiAJQgyGQoDg//////8HgyALQjSIhCIJNwMIAkACQCAJIA6EIBGEIAiEIAyEUARAQcSPKiABQawBaigCACABQagBaigCABEAACACQciRKkHYABBIGiADDQEMAgtBASEFIANFDQEgAyAEIAZBDGoQKCAGKAIMIAMpAxggAykDECADKQMIIAMpAwCEhIRQckUNAUH4iSogAUGsAWooAgAgAUGoAWooAgARAAAgAkHIkSpB2AAQSBoLQQAhBSADQRhqQeCQKikDADcDACADQRBqQdiQKikDADcDACADQQhqQdCQKikDADcDACADQciQKikDADcDAAsgBkEQaiQAAkAgAC0A6AFBAXFFBEAgACkD2AMhDCAAKQPgAyEJIAApA+gDIQggACkD8AMhCgwBCyAAQn9CACAAKQPwAyINIAApA+gDIgsgACkD4AMiCSAAKQPYAyIIhISEQgBSGyIKIAhCf4UiCEK+/ab+sq7olsAAfSIPgyIMNwPYAyAAIAggD1atIAlCf4UiD3wiCELFv92FlePIqMUAfSIQIAqDIgk3A+ADIAAgCCAPVK0gCCAQVq18IAtCf4UiD3wiC0ICfSIQIAqDIgg3A+gDIAAgCyAPVK0gCyAQVq18IA19QgJ9IAqDIgo3A/ADCyAAIAw8AB8gACAMQgiIPAAeIAAgDEIQiDwAHSAAIAxCGIg8ABwgACAMQiCIPAAbIAAgDEIoiDwAGiAAIAxCMIg8ABkgACAMQjiIPAAYIAAgCTwAFyAAIAlCCIg8ABYgACAJQhCIPAAVIAAgCUIYiDwAFCAAIAlCIIg8ABMgACAJQiiIPAASIAAgCUIwiDwAESAAIAlCOIg8ABAgACAIPAAPIAAgCEIIiDwADiAAIAhCEIg8AA0gACAIQhiIPAAMIAAgCEIgiDwACyAAIAhCKIg8AAogACAIQjCIPAAJIAAgCEI4iDwACCAAIAo8AAcgACAKQgiIPAAGIAAgCkIQiDwABSAAIApCGIg8AAQgACAKQiCIPAADIAAgCkIoiDwAAiAAIApCMIg8AAEgACAKQjiIPAAAIAAgACkD4AEiCDwAJSAAIAApA9ABIgk8ADIgACAIQgiIPAAkIAAgCEIQiDwAIyAAIAhCGIg8ACIgACAIQiCIPAAhIAAgCEIoiDwAICAAIAApA9gBIghCBIg8ACsgACAIQgyIPAAqIAAgCEIUiDwAKSAAIAhCHIg8ACggACAIQiSIPAAnIAAgCEIsiDwAJiAAIAlCCIg8ADEgACAJQhCIPAAwIAAgCUIYiDwALyAAIAlCIIg8AC4gACAJQiiIPAAtIAAgCUIwiEIPgyAIQgSGhDwALCAAIAApA8ABIgk8AD8gACAAKQPIASIIQgSIPAA4IAAgCEIMiDwANyAAIAhCFIg8ADYgACAIQhyIPAA1IAAgCEIkiDwANCAAIAhCLIg8ADMgACAJQgiIPAA+IAAgCUIQiDwAPSAAIAlCGIg8ADwgACAJQiCIPAA7IAAgCUIoiDwAOiAAIAlCMIhCD4MgCEIEhoQ8ADkgAEFAayICQaGCKEEgIAAgAEEgakGwlCpBDSAHED8hAyAAQZgDaiIGIAJBABAoIAUgA0EAR3EgACkDsAMiCiAAKQOoAyILIAApA6ADIgggACkDmAMiDISEhEIAUnEiAkUiBa0iDUIBfSEJIAAgCSAKgyIKNwOwAyAAIAkgC4MiEDcDqAMgACAIIAmDIhE3A6ADIAAgCSAMgyANhCIMNwOYAyABIABBmAJqIgEgBhAyIABB6ABqIAEQMyAAQZgBaikDACAAKQOQASAAQbABaikDACIOQjCIQtGHgIAQfnwiEkI0iHwiCUL/////////B4MhCyAAQagBaikDACAAQaABaikDACAJQjSIfCIPQjSIfCIIQv////////8HgyENIAAgCSAPQv////////8HgyIPgyAIg0L/////////B1EgDkL///////8/gyAIQjSIfCIJQv///////z9RcSASQv////////8HgyIIQq74///v//8HVnGtIAlCMIiEpwR+IAhC0YeAgBB8Ig5C/////////weDIQggCyAOQjSIfCIOQv////////8HgyELIA8gDkI0iHwiDkL/////////B4MhDyANIA5CNIh8Ig5C/////////weDIQ0gDkI0iCAJfEL///////8/gwUgCQs3A7ABIAAgDTcDqAEgACAPNwOgASAAIAs3A5gBIAAgCDcDkAEgCEIBg6cEQCAAQn9CACAQIBGEIAqEIAyEQgBSGyIJIAxCf4UiCEK+/ab+sq7olsAAfSILgyIMNwOYAyAAIAggC1atIBFCf4UiC3wiCELFv92FlePIqMUAfSINIAmDIhE3A6ADIAAgCCALVK0gCCANVq18IBBCf4UiC3wiCEICfSINIAmDIhA3A6gDIAAgCCALVK0gCCANVq18IAp9QgJ9IAmDIgo3A7ADCyAAKQNwIAApA2ggACkDiAEiDkIwiELRh4CAEH58IhJCNIh8IglC/////////weDIQggACkDgAEgACkDeCAJQjSIfCIPQjSIfCINQv////////8HgyELIAAgCSAPQv////////8HgyIPgyANg0L/////////B1EgDkL///////8/gyANQjSIfCIJQv///////z9RcSASQv////////8HgyINQq74///v//8HVnGtIAlCMIiEpwR+IA1C0YeAgBB8Ig5C/////////weDIQ0gCCAOQjSIfCIOQv////////8HgyEIIA8gDkI0iHwiDkL/////////B4MhDyALIA5CNIh8Ig5C/////////weDIQsgDkI0iCAJfEL///////8/gwUgCQs3A4gBIAAgCzcDgAEgACAPNwN4IAAgCDcDcCAAIA03A2hBpZYqIABB6ABqECcgAELAADcD2AQgAELkotiHqc3t9DM3A5AEIABC0OqhvtnssR43A4gEIABCkqKei/HBn7FRNwOABCAAQpH0sueZ8JTJIzcD+AMgAEH4A2oiAUGllipBIBAfIAEgAEEgakEgEB8gAUGhgihBIBAfIAEgAEHgBGoiAxAgIABBuANqIgEgA0EAECggASABIABB2ANqECsgDCAMIAApA7gDfCIMVq0iCyAAKQPAA3wiCCARfCEJIAggC1StIAggCVatfCINIAApA8gDfCILIBB8IQggCiALIA1UrSAIIAtUrXwiDSAAKQPQA3wiCnwiC0J/UiAIQn5UciEDIAAgDCAKIA1UIAogC1ZqIAxCwILZgc3Rl+m/f1YgCUK7wKL66py317p/VnIgCUK7wKL66py317p/VCADckF/c3EgA0F/cyAIQn9RcXJqrSIMQr/9pv6yruiWwAB+Igp8Ig03A7gDIAAgCiANVq0gCSAMQsS/3YWV48ioxQB+fCIKfCINNwPAAyAAIAkgClatIAogDVatfCAIIAx8Igl8Igw3A8gDIAAgCCAJVq0gCSAMVq18IAt8NwPQA0HFliogARApIAAgBTYC+ANBpZYqIAAoAvgDQQFrIgFBpZYqLQAAcToAAEGmlipBppYqLQAAIAFxOgAAQaeWKkGnliotAAAgAXE6AABBqJYqQaiWKi0AACABcToAAEGplipBqZYqLQAAIAFxOgAAQaqWKkGqliotAAAgAXE6AABBq5YqQauWKi0AACABcToAAEGslipBrJYqLQAAIAFxOgAAQa2WKkGtliotAAAgAXE6AABBrpYqQa6WKi0AACABcToAAEGvlipBr5YqLQAAIAFxOgAAQbCWKkGwliotAAAgAXE6AABBsZYqQbGWKi0AACABcToAAEGylipBspYqLQAAIAFxOgAAQbOWKkGzliotAAAgAXE6AABBtJYqQbSWKi0AACABcToAAEG1lipBtZYqLQAAIAFxOgAAQbaWKkG2liotAAAgAXE6AABBt5YqQbeWKi0AACABcToAAEG4lipBuJYqLQAAIAFxOgAAQbmWKkG5liotAAAgAXE6AABBupYqQbqWKi0AACABcToAAEG7lipBu5YqLQAAIAFxOgAAQbyWKkG8liotAAAgAXE6AABBvZYqQb2WKi0AACABcToAAEG+lipBvpYqLQAAIAFxOgAAQb+WKkG/liotAAAgAXE6AABBwJYqQcCWKi0AACABcToAAEHBlipBwZYqLQAAIAFxOgAAQcKWKkHCliotAAAgAXE6AABBw5YqQcOWKi0AACABcToAAEHElipBxJYqLQAAIAFxOgAAQcWWKkHFliotAAAgAXE6AABBxpYqQcaWKi0AACABcToAAEHHlipBx5YqLQAAIAFxOgAAQciWKkHIliotAAAgAXE6AABByZYqQcmWKi0AACABcToAAEHKlipBypYqLQAAIAFxOgAAQcuWKkHLliotAAAgAXE6AABBzJYqQcyWKi0AACABcToAAEHNlipBzZYqLQAAIAFxOgAAQc6WKkHOliotAAAgAXE6AABBz5YqQc+WKi0AACABcToAAEHQlipB0JYqLQAAIAFxOgAAQdGWKkHRliotAAAgAXE6AABB0pYqQdKWKi0AACABcToAAEHTlipB05YqLQAAIAFxOgAAQdSWKkHUliotAAAgAXE6AABB1ZYqQdWWKi0AACABcToAAEHWlipB1pYqLQAAIAFxOgAAQdeWKkHXliotAAAgAXE6AABB2JYqQdiWKi0AACABcToAAEHZlipB2ZYqLQAAIAFxOgAAQdqWKkHaliotAAAgAXE6AABB25YqQduWKi0AACABcToAAEHclipB3JYqLQAAIAFxOgAAQd2WKkHdliotAAAgAXE6AABB3pYqQd6WKi0AACABcToAAEHflipB35YqLQAAIAFxOgAAQeCWKkHgliotAAAgAXE6AABB4ZYqQeGWKi0AACABcToAAEHilipB4pYqLQAAIAFxOgAAQeOWKkHjliotAAAgAXE6AABB5JYqQeSWKi0AACABcToAAAsgAEGABWokACAEIAI2AmQgAg0BDAILDAELIARBgAFqJAAPCyAEQQA2AnAgBEHoAGoQBwALrxQCEH8SfiMAQcABayIEJAAgBEGAAWoiA0E4aiIJQgA3AwAgA0EwaiIKQgA3AwAgA0EoaiILQgA3AwAgA0EgaiIMQgA3AwAgA0EYaiINQgA3AwAgA0EQaiIOQgA3AwAgA0EIaiIPQgA3AwAgBEIANwOAAQJAQcCUKigCACADQYSVKiAAECFBAUYEQCAEQUBrIgBBCGoiECADQQ9qKQAANwMAIABBEGoiESADQRdqKQAANwMAIABBGGoiBSADQR9qKQAANwMAIABBIGoiCCADQSdqKQAANwMAIABBKGoiAiADQS9qKQAANwMAIABBMGoiByADQTdqKQAANwMAIABBOGoiBiADQT9qLQAAOgAAIAQgBC0AggE6AAIgBCAELwGAATsBACAEIAQpAIcBNwNAIAQoAIMBIQAgBEE/aiAGLQAAOgAAIARBN2ogBykDADcAACAEQS9qIAIpAwA3AAAgBEEnaiAIKQMANwAAIARBH2ogBSkDADcAACAEQRdqIBEpAwA3AAAgBEEPaiAQKQMANwAAIAQgADYAAyAEIAQpA0A3AAcgCUIANwMAIApCADcDACALQgA3AwAgDEIANwMAIA1CADcDACAOQgA3AwAgD0IANwMAIARCADcDgAFBACEGQcCUKigCACEAQQAhByMAQdAAayIFJAAgBUEANgIMAkAgA0UEQEHUjCogAEGsAWooAgAgAEGoAWooAgARAAAMAQsgBUEwaiIIQaWWKiAFQQxqIgcQKCAFKAIMIQAgBUEQaiICQcWWKiAHECggACAFKAIMckUEQCADIAUpAzA3AAAgAyAFKQMQNwAgIANBGGogCEEYaikDADcAACADQRBqIAhBEGopAwA3AAAgA0EIaiAIQQhqKQMANwAAIANBKGogAkEIaikDADcAACADQTBqIAJBEGopAwA3AAAgA0E4aiACQRhqKQMANwAAQQEhBwwBCyADQgA3AAAgA0E4akIANwAAIANBMGpCADcAACADQShqQgA3AAAgA0EgakIANwAAIANBGGpCADcAACADQRBqQgA3AAAgA0EIakIANwAAQQAhBwsgBUHQAGokACAHRQRAQQQQAQwCCyABRQRAAkBBwJQqKAIAIQAgBEGAAWoiAUUEQEG0jCogAEGsAWooAgAgAEGoAWooAgARAAAMAQsgASkAOCIWQj+IpyIAIAEpACAiGUKgwezA5ujL9F9WIAEpACgiF0KdoJG9tc7bq90AVnIgASkAMCIYQn9SIBdCnaCRvbXO26vdAFRyIABBf3NxIBZC////////////AFRyQX9zcXIhACABBEAgAARAIBlCf4UiEkK+/ab+sq7olsAAfSEaIBIgGlatIBdCf4UiEnwiE0LFv92FlePIqMUAfSEUIBIgE1atIBMgFFatfCAYQn+FIhJ8IhVCAn0hEyASIBVWrSATIBVUrXwgFn1CAn1Cf0IAIBcgGYQgGIQgFoRCAFIbIhKDIRYgEiAagyEZIBIgFIMhFyASIBODIRgLIAFBCGoiACkAACEVIAFBEGoiAikAACETIAEpAAAhEiABQRhqIgMgAykAADcAACACIBM3AAAgACAVNwAAIAEgEjcAACABIBY3ADggASAYNwAwIAEgFzcAKCABIBk3ACALCwsQCCEBIwBB0ANrIgIkAAJAIARBgAFqIgNFBEBB1IwqIAFBrAFqKAIAIAFBqAFqKAIAEQAADAELIARFBEBB5osqIAFBrAFqKAIAIAFBqAFqKAIAEQAADAELIAJBCGpBoYIoQQAQKCACQShqIgBBGGogA0EYaikAADcDACAAQRBqIANBEGopAAA3AwAgAEEIaiADQQhqKQAANwMAIAIgAykAADcDKCADKQA4IhtCP4inIgAgAykAICIdQqDB7MDm6Mv0X1YgAykAKCIcQp2gkb21ztur3QBWciADKQAwIh5Cf1IgHEKdoJG9tc7bq90AVHIgAEF/c3EgG0L///////////8AVHJBf3Nxcg0AIAQpAAgiEkIMhkKA4P//////B4MgBCkAACIUQjSIhCEgIAQpABAiE0IYhkKAgID4////B4MgEkIoiIQhISAEKQAYIhJCEIghIiASQiSGQoCAgICA/v8HgyATQhyIhCIVICEgIiAUQv////////8HgyITICCEhISEUARAQcSPKiABQawBaigCACABQagBaigCABEAAAwBCyACKQNAIh8gAikDOCIXIAIpAzAiIyACKQMoIhaEhIRQDQAgHCAdhCAehCAbhFANACAEKQAwIRkgBCkAOCEYIAQpACghGiAEKQAgIRQgAiAbQjiINwPoASACIB1C//////////8/gzcDyAEgAiAbQgaGIB5COoiEQv//////////P4M3A+ABIAIgHkIEhiAcQjyIhEL//////////z+DNwPYASACIBxCAoYgHUI+iIRC//////////8/gzcD0AEgAkHIAWoiB0GQkSoQKiACIAIpA+gBQjiGIAIpA+ABIhJCBoiENwPIAyACIBJCOoYgAikD2AEiEkIEiIQ3A8ADIAIgEkI8hiACKQPQASISQgKIhDcDuAMgAiACKQPIASASQj6GhDcDsAMgAkGQA2oiAyACQbADaiIAIAJBCGoQKyACQfACaiIBIAAgAkEoahArIAJBoAJqQgA3AwAgAkGQAmogGEIQiDcDACACQYgCaiAYQiSGQoCAgICA/v8HgyAZQhyIhDcDACACQYACaiAZQhiGQoCAgPj///8HgyAaQiiIhDcDACACQfgBaiAaQgyGQoDg//////8HgyAUQjSIhDcDACACQagCakIANwMAIAJBsAJqQgA3AwAgAkG4AmpCADcDACACQgE3A5gCIAIgFEL/////////B4M3A/ABIAIgIjcD6AEgAiAVNwPgASACICE3A9gBIAIgIDcD0AEgAiATNwPIASACQQA2AsACIAJByABqIgAgByABIAMQLCACKALAAQ0AIAIgH0IQiDcD6AIgAiAWQv////////8HgyITNwPIAiACIB9CJIZCgICAgID+/weDIBdCHIiEIhI3A+ACIAIgF0IYhkKAgID4////B4MgI0IoiIQiFDcD2AIgAiAjQgyGQoDg//////8HgyAWQjSIhCIVNwPQAkEBIQYgAkHIAmogABAtDQAgH0L//wNWBEBBACEGDAELIBJCAFIEQEEAIQYMAQsgFEKjopUKVgRAQQAhBgwBCwJAIBRCo6KVClINACAVQoKI8a+3oeUAVgRAQQAhBgwCCyAVQoKI8a+3oeUAUg0AQQAhBiATQu31pv6irugGVg0BCyACQv///////z83A+gCIAJC/////////wc3A+ACIAIgFELc3er1////B3w3A9gCIAIgFUL9947QyN6aB3w3A9ACIAIgE0LBgtmBzdGXAXw3A8gCIAJByAJqIAJByABqEC1BAEchBgsgAkHQA2okAAwBC0EBEAELIARBwAFqJAAgBgvUDgIIfwp+IwBBsAFrIgUkACAFQQhqIgNBwQAQRhpBwJQqKAIAIQQjAEHQAGsiAiQAIAJBADYCDAJAIANFBEBB1IwqIARBrAFqKAIAIARBqAFqKAIAEQAADAELIAFBBE8EQEHCjiogBEGsAWooAgAgBEGoAWooAgARAAAMAQsgAkEwaiIGQaWWKiACQQxqIgQQKCACKAIMIQcgAkEQaiIIQcWWKiAEECggByACKAIMckUEQCADIAIpAzA3AAAgAyACKQMQNwAgIAMgAToAQCADQRhqIAZBGGopAwA3AAAgA0EQaiAGQRBqKQMANwAAIANBCGogBkEIaikDADcAACADQShqIAhBCGopAwA3AAAgA0EwaiAIQRBqKQMANwAAIANBOGogCEEYaikDADcAAEEBIQcMAQtBACEHIANBwQAQRhoLIAJB0ABqJAACQAJAIAdFBEBBBBABDAELIAVBiAFqQgA3AwAgBUGAAWpCADcDACAFQfgAakIANwMAIAVB8ABqQgA3AwAgBUHoAGpCADcDACAFQeAAakIANwMAIAVB2ABqQgA3AwAgBUIANwNQEAghASAFQdAAaiEEIwBBgAVrIgIkAAJ/AkAgBUEIaiIDRQRAQeCMKiABQawBaigCACABQagBaigCABEAAAwBCyAERQRAQeaLKiABQawBaigCACABQagBaigCABEAAAwBCyACQTBqIANBKGopAAA3AwAgAkE4aiADQTBqKQAANwMAIAJBQGsgA0E4aikAADcDACACIAMpACA3AyggAy0AQCEBIAMpABghDiADKQAQIQ8gAykACCEQIAMpAAAhCyACQQhqQaGCKEEAECgCQCAOIA8gCyAQhISEUA0AIAIpA0AgAikDOCACKQMwIAIpAyiEhIRQDQAgAiALQv////////8HgyITNwPYBCACIA5CEIhC//////8fgyAOQjiIIgxCKIaEIhE3A/gEIAIgDkIkhkKAgICAgP7/B4MgD0IciIQiCjcD8AQgAiAPQhiGQoCAgPj///8HgyAQQiiIhCINNwPoBCACIBBCDIZCgOD//////weDIAtCNIiEIhI3A+AEIAFBAnEEQCARQgBSDQEgCkIAUg0BIA1Co6KVClYNAQJAIA1Co6KVClINACASQoKI8a+3oeUAVg0CIBJCgojxr7eh5QBSDQAgE0Lt9ab+oq7oBlYNAgsgAkL///////8/NwP4BCACQv////////8HNwPwBCACIA1C3N3q9f///wd8NwPoBCACIBJC/feO0Mjemgd8NwPgBCACIBNCwYLZgc3RlwF8NwPYBAsgAkGABGoiAyACQdgEaiABQQFxECNFDQAgAkGAA2oiBkEIaiADQQhqKQMANwMAIAZBEGogA0EQaikDADcDACAGQRhqIANBGGopAwA3AwAgBkEgaiADQSBqKQMANwMAIAZBMGogA0EwaikDADcDACAGQThqIANBOGopAwA3AwAgBkFAayADQUBrKQMANwMAIAZByABqIANByABqKQMANwMAIAIgAigC0AQ2AvgDIAIgAikDgAQ3A4ADIAIgAikDqAQ3A6gDIAJB2ANqQgA3AwAgAkHgA2pCADcDACACQegDakIANwMAIAJB8ANqQgA3AwAgAkIBNwPQAyACIAw3A2ggAiAOQgaGIA9COoiEQv//////////P4M3A2AgAiAPQgSGIBBCPIiEQv//////////P4M3A1ggAiAQQgKGIAtCPoiEQv//////////P4M3A1AgAiALQv//////////P4M3A0ggAkHIAGoiCEGQkSoQKiACIAIpA2hCOIYgAikDYCIKQgaIhDcD+AIgAiAKQjqGIAIpA1giCkIEiIQ3A/ACIAIgCkI8hiACKQNQIgpCAoiENwPoAiACIAIpA0ggCkI+hoQ3A+ACIAJBwAJqIgcgAkHgAmoiASACQQhqECsgAkJ/QgAgAikD2AIiEyACKQPQAiISIAIpA8gCIgwgAikDwAIiCoSEhEIAUhsiCyAKQn+FIhFCvv2m/rKu6JbAAH0iCoM3A8ACIAIgDEJ/hSIMIAogEVStfCINQsW/3YWV48ioxQB9IgogC4M3A8gCIAIgEkJ/hSIRIAwgDVatIAogDVStfHwiDEICfSIKIAuDNwPQAiACIAwgEVStIAogDFStfCATfUICfSALgzcD2AIgAkGgAmoiAyABIAJBKGoQKyACQaABaiIBIAYgAyAHECwgCCABEDogAigCmAINACAEIAgQJUEBDAILIARCADcAACAEQThqQgA3AAAgBEEwakIANwAAIARBKGpCADcAACAEQSBqQgA3AAAgBEEYakIANwAAIARBEGpCADcAACAEQQhqQgA3AAALQQALIQEgAkGABWokACABRQ0AIAUgADYCkAEgBUHAlCooAgAgBUGQAWogBEGCAkECIABBIUYbECYiADYClAEgAEEBRw0BQQEhCQsgBUGwAWokACAJDwsgBUEANgKgASAFQZgBahAHAAv0DwIJfxB+IwBBwAFrIgEkACABQYABaiICQThqQgA3AwAgAkEwakIANwMAIAJBKGpCADcDACACQSBqQgA3AwAgAkEYakIANwMAIAJBEGpCADcDACACQQhqQgA3AwAgAUIANwOAAQJAQcCUKigCACACQcWVKhA7QQFGBEAgAUFAayIAQQhqIgMgAkEPaikAADcDACAAQRBqIgQgAkEXaikAADcDACAAQRhqIgUgAkEfaikAADcDACAAQSBqIgYgAkEnaikAADcDACAAQShqIgcgAkEvaikAADcDACAAQTBqIgggAkE3aikAADcDACAAQThqIgAgAkE/ai0AADoAACABIAEtAIIBOgACIAEgAS8BgAE7AQAgASABKQCHATcDQCABKACDASECIAFBP2ogAC0AADoAACABQTdqIAgpAwA3AAAgAUEvaiAHKQMANwAAIAFBJ2ogBikDADcAACABQR9qIAUpAwA3AAAgAUEXaiAEKQMANwAAIAFBD2ogAykDADcAACABIAI2AAMgASABKQNANwAHEAghA0EAIQIjAEHwA2siACQAAkAgAUUEQEHmiyogA0GsAWooAgAgA0GoAWooAgARAAAMAQsgAEGIAWpBpZYqECJFDQAgAEHQA2pBxZYqIABBDGoQKCAAKAIMDQAgASkAACILQjSIIhMgASkACCIMQgyGIg1CgOD//////weDhCEPIAEpABAiCkIYhiIQQoCAgPj///8HgyIUIAxCKIgiFYQhESABKQAYIglCEIghDiAKQhyIIhcgCUIkhiIWQoCAgICA/v8Hg4QiGCARIA4gC0L/////////B4MiEiAPhISEhFAEQEHEjyogA0GsAWooAgAgA0GoAWooAgARAAAMAQsgACAVPAAiIAAgDjwAFSAAIA1CFIg8ACYgACANQhyIPAAlIAAgDUIkiDwAJCAAIA1CLIg8ACMgACAQQiCIPAAeIAAgEEIoiDwAHSAAIBZCLIg8ABYgACALPAAvIAAgC0IIiDwALiAAIAtCEIg8AC0gACALQhiIPAAsIAAgC0IgiDwAKyAAIAtCKIg8ACogACATQgSGIBJCMIiEPAApIAAgC0I4iDwAKCAAIAw8ACcgACAMQjCIPAAhIAAgDEI4iDwAICAAIBdCBIYgFEIwiIQ8ABwgACAKPAAfIAAgCkIgiDwAGyAAIApCKIg8ABogACAKQjCIPAAZIAAgCkI4iDwAGCAAIAk8ABcgACAJQhiIPAAUIAAgCUIgiDwAEyAAIAlCKIg8ABIgACAJQjCIPAARIAAgCUI4iDwAECABKQAgIQsgASkAKCEJIAEpADAhCiABKQA4IQwgAELAADcDkAMgAELkotiHqc3t9DM3A8gCIABC0OqhvtnssR43A8ACIABCkqKei/HBn7FRNwO4AiAAQpH0sueZ8JTJIzcDsAIgAEGwAmoiBEGllipBIBAfIAQgAEEQakEgEB8gBEGhgihBIBAfIAQgAEEwaiIDECAgAEGwA2oiBiADQQAQKCAAQbABaiIFQcgAaiAMQhCINwMAIAVBQGsgDEIkhkKAgICAgP7/B4MgCkIciIQ3AwAgBUE4aiAKQhiGQoCAgPj///8HgyAJQiiIhDcDACAFQTBqIAlCDIZCgOD//////weDIAtCNIiENwMAIABBADYCqAIgAEIBNwOAAiAAIAtC/////////weDNwPYASAAIA43A9ABIAAgGDcDyAEgACARNwPAASAAIA83A7gBIAAgEjcDsAEgAEJ/QgAgACkDyAMiDSAAKQPAAyIMIAApA7gDIgkgACkDsAMiCoSEhEIAUhsiCyAKQn+FIgpCvv2m/rKu6JbAAH0iDoM3A7ADIAAgCiAOVq0gCUJ/hSIKfCIJQsW/3YWV48ioxQB9Ig4gC4M3A7gDIAAgDEJ/hSIMIAkgClStIAkgDlatfHwiCUICfSIKIAuDNwPAAyAAIAkgDFStIAkgClatfCANfUICfSALgzcDyAMgAEGgAmpCADcDACAAQZgCakIANwMAIABBkAJqQgA3AwAgAEGIAmpCADcDACAEIAUgBiAAQdADahAsIAMgBBA6IAAoAoABDQAgA0FAaykDACADQThqKQMAIANBMGopAwAgACkDWCADQcgAaikDACIKQjCIQtGHgIAQfnwiC0I0iHwiDEI0iHwiDUI0iHwhCSAJIAwgDYODQv////////8Hg0L/////////B1EgCkL///////8/gyAJQjSIfCIJQv///////z9RcSALQv////////8Hg0Ku+P//7///B1ZxrSAJQjCIhCALfKdBAXENACAAKQMwIAApA4gBfSAAKQNQIAApA6gBfUL8////////AXwiCkIwiELRh4CAEH58Qrzh//+///8ffCILQv////////8HgyIMQtCHgIAQhSEJIAxCAFIgCUL/////////B1JxDQAgCkL///////8/gyAAKQNIIAApA6ABfSAAKQNAIAApA5gBfSAAKQM4IAtCNIggACkDkAF9fEL8////////H3wiCkI0iHxC/P///////x98IgxCNIh8Qvz///////8ffCINQjSIfCEOIA4gCiALhCAMhCANhEL/////////B4OEUAR/QQEFIAkgDkKAgICAgIDAB4WDIAqDIAyDIA2DQv////////8HUQshAgsgAEHwA2okACACQQFGIQAMAQtBARABCyABQcABaiQAIAALOQACQAJ/IAJBgIDEAEcEQEEBIAAgAiABKAIQEQEADQEaCyADDQFBAAsPCyAAIAMgBCABKAIMEQIACzABAX8gAC0AAARAIABBAWohAUEAIQADQCAAIAFqIQIgAEEBaiEAIAItAAANAAsLAAurQQJHfwF+IAAgACkDYCJKIAKtfDcDYCACQcAAIEqnQT9xIgVrIjVPBEAgAEEgaiFGA0AgBSBGaiABIDUQSBogAC0AQyIVIAAtAEFBEHQgAC0AQEEYdHIiBCAALQBCQQh0cnIhHSAALQAnIhQgAC0AJUEQdCAALQAkQRh0ciIDIAAtACZBCHRyciEJIAAtADsiBiAALQA5QRB0IAAtADhBGHRyIgggAC0AOkEIdHJyIREgAC0AMyIHIAAtADFBEHQgAC0AMEEYdHIiDCAALQAyQQh0cnIhCyAALQArIg0gAC0AKUEQdCAALQAoQRh0ciIQIAAtACpBCHRyciEKIAAtAEciDiAALQBF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ciAKQR53IApBE3dzIApBCndzaiBBaiIJID9qIhEgCyAPc3EgC3NqIBFBGncgEUEVd3MgEUEHd3NqQdz6ge4GayFBIAsgE2ogCSAKciAVcSAJIApxciAJQR53IAlBE3dzIAlBCndzaiBCaiILIEFqIhMgDyARc3EgD3NqIBNBGncgE0EVd3MgE0EHd3NqQavCjqcFayFCIA8gHWogCSALciAKcSAJIAtxciALQR53IAtBE3dzIAtBCndzaiBJaiIKIEJqIg8gESATc3EgEXNqIA9BGncgD0EVd3MgD0EHd3NqQeiq4b8CayEdIBEgJ2ogCiALciAJcSAKIAtxciAKQR53IApBE3dzIApBCndzaiAyaiIJIB1qIhEgDyATc3EgE3NqIBFBGncgEUEVd3MgEUEHd3NqQYG2jZQBaiEnIBMgKWogCSAKciALcSAJIApxciAJQR53IAlBE3dzIAlBCndzaiA/aiILICdqIhMgDyARc3EgD3NqIBNBGncgE0EVd3MgE0EHd3NqQb6LxqECaiEpIA8gKmogCSALciAKcSAJIAtxciALQR53IAtBE3dzIAtBCndzaiBBaiIKIClqIg8gESATc3EgEXNqIA9BGncgD0EVd3MgD0EHd3NqQcP7sagFaiEqIBEgKGogCiALciAJcSAKIAtxciAKQR53IApBE3dzIApBCndzaiBCaiIJICpqIhEgDyATc3EgE3NqIBFBGncgEUEVd3MgEUEHd3NqQfS6+ZUHaiEoIBMgNGogCSAKciALcSAJIApxciAJQR53IAlBE3dzIAlBCndzaiAdaiILIChqIhMgDyARc3EgD3NqIBNBGncgE0EVd3MgE0EHd3NqQYKchfkHayEdIA8gFmogCSALciAKcSAJIAtxciALQR53IAtBE3dzIAtBCndzaiAnaiIKIB1qIhYgESATc3EgEXNqIBZBGncgFkEVd3MgFkEHd3NqQdnyj6EGayEPIBEgF2ogCiALciAJcSAKIAtxciAKQR53IApBE3dzIApBCndzaiApaiIJIA9qIhcgEyAWc3EgE3NqIBdBGncgF0EVd3MgF0EHd3NqQYydkPMDayERIAMgE2ogCSAKciALcSAJIApxciAJQR53IAlBE3dzIAlBCndzaiAqaiIDIBFqIgsgFiAXc3EgFnNqIAtBGncgC0EVd3MgC0EHd3NqQb+sktsBayETIAQgFmogAyAJciAKcSADIAlxciADQR53IANBE3dzIANBCndzaiAoaiIEIBNqIgogCyAXc3EgF3NqIApBGncgCkEVd3MgCkEHd3NqQfrwhoIBayEWIAcgF2ogAyAEciAJcSADIARxciAEQR53IARBE3dzIARBCndzaiAdaiIHIBZqIgkgCiALc3EgC3NqIAlBGncgCUEVd3MgCUEHd3NqQca7hv4AaiEXIAYgC2ogBCAHciADcSAEIAdxciAHQR53IAdBE3dzIAdBCndzaiAPaiIDIBdqIgsgCSAKc3EgCnNqIAtBGncgC0EVd3MgC0EHd3NqQczDsqACaiEPIAogDGogAyAHciAEcSADIAdxciADQR53IANBE3dzIANBCndzaiARaiIEIA9qIgwgCSALc3EgCXNqIAxBGncgDEEVd3MgDEEHd3NqQe/YpO8CaiEKIAggCWogAyAEciAHcSADIARxciAEQR53IARBE3dzIARBCndzaiATaiIGIApqIgggCyAMc3EgC3NqIAhBGncgCEEVd3MgCEEHd3NqQaqJ0tMEaiEJIAsgDWogBCAGciADcSAEIAZxciAGQR53IAZBE3dzIAZBCndzaiAWaiIDIAlqIgcgCCAMc3EgDHNqIAdBGncgB0EVd3MgB0EHd3NqQdzTwuUFaiENIAUgDGogAyAGciAEcSADIAZxciADQR53IANBE3dzIANBCndzaiAXaiIFIA1qIgwgByAIc3EgCHNqIAxBGncgDEEVd3MgDEEHd3NqQdqR5rcHaiELIAggEGogAyAFciAGcSADIAVxciAFQR53IAVBE3dzIAVBCndzaiAPaiIEIAtqIgYgByAMc3EgB3NqIAZBGncgBkEVd3MgBkEHd3NqQa7dhr4GayEQIAcgDmogBCAFciADcSAEIAVxciAEQR53IARBE3dzIARBCndzaiAKaiIDIBBqIgggBiAMc3EgDHNqIAhBGncgCEEVd3MgCEEHd3NqQZPzuL4FayEOIAwgGWogAyAEciAFcSADIARxciADQR53IANBE3dzIANBCndzaiAJaiIFIA5qIgcgBiAIc3EgBnNqIAdBGncgB0EVd3MgB0EHd3NqQbiw8/8EayEMIAYgEmogAyAFciAEcSADIAVxciAFQR53IAVBE3dzIAVBCndzaiANaiIEIAxqIgYgByAIc3Eg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fCIaQjCIQtGHgIAQfnxCvOH//7///x98IhxC/////////weDIhVC0IeAgBCFIR8gFUIAUiAfQv////////8HUnFFBEAgIkL/////////B4MgGEL/////////B4N9ICBC/////////weDIBdC/////////weDfSAeQv////////8HgyAWQv////////8Hg30gHEI0iHxC/P///////x98IhZCNIh8Qvz///////8ffCIXQjSIfEL8////////H3wiGCAfIBpC////////P4MgGEI0iHxCgICAgICAwAeFgyAWgyAXg4NC/////////wdRIQILIAIhAwsgA0UNACABIARBoAVqECVBASEACyAEQfAGaiQAIAAL/gIBBX4gACABMQAfIAExAB5CCIaEIAExAB1CEIaEIAExABxCGIaEIAExABtCIIaEIAExABpCKIaEIAExABlCD4NCMIaEIgI3AwAgACABLQAZQQR2rSABMQAYQgSGhCABMQAXQgyGhCABMQAWQhSGhCABMQAVQhyGhCABMQAUQiSGhCABMQATQiyGhCIDNwMIIAAgATEAEiABMQARQgiGhCABMQAQQhCGhCABMQAPQhiGhCABMQAOQiCGhCABMQANQiiGhCABMQAMQg+DQjCGhCIENwMQIAAgAS0ADEEEdq0gATEAC0IEhoQgATEACkIMhoQgATEACUIUhoQgATEACEIchoQgATEAB0IkhoQgATEABkIshoQiBTcDGCAAIAExAAUgATEABEIIhoQgATEAA0IQhoQgATEAAkIYhoQgATEAAUIghoQgATEAAEIohoQiBjcDICADIASDIAWDQv////////8HUiAGQv///////z9SciACQq/4///v//8HVHILl9QBAgx/EH4jAEHAO2siAyQAIABBIGogAUEgaikDADcDACAAQRhqIAFBGGopAwA3AwAgAEEQaiABQRBqKQMANwMAIABBCGogAUEIaikDADcDACAAIAEpAwA3AwAgA0G4N2oiDSABEDggA0GQN2oiBiABIA0QJCAAQQA2AlAgAyADKQOQN0IHfCITNwOQNyADQcA1aiIBIAMpA6g3Ig9CACATQgGGIhVCABBHIANB4DVqIg0gAykDoDciEkIAIAMpA5g3IhFCAYYiF0IAEEcgA0HgNmoiBSADKQOwNyIQQgAgEEIAEEcgA0HQNmoi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gIACQgAQRyADKQPwMSIZIAMpA7A0fCEVIANB8DpqIgFBCGoiCyAVIBlUrSAFQQhqKQMAIARBCGopAwB8fCIdQgyGIBVCNIiEIAMpA6AyIh4gAykDoDR8Ihl8IhpC/////////weDNwMAIANB4DNqIgUgEkIAIBRCABBHIANBkDRqIgQgE0IAIBNCABBHIANB8DJqIgwgEEIAIA9CABBHIANBkDJqIg4gFiAYVq0gFiAcVK0gCEEIaikDACAJQQhqKQMAfHwgG0I0iHx8IhBCDIYgGEI0iIQiFCADKQPwMnwiFkIAQpD6gICAAkIAEEcgAUEQaiIIIBkgGlatIBkgHlStIApBCGopAwAgB0EIaikDAHx8IB1CNIh8fCIYQgyGIBpCNIiEIAMpA+AzIhkgAykDkDR8Ig8gAykDkDJ8IhJ8IhNC/////////weDNwMAIANBgDJqIgcgFCAWVq0gDEEIaikDACAQQjSIfHxCAEKAgMSegIDAAEIAEEcgAUEYaiIJIBIgE1atIA8gElatIA5BCGopAwAgDyAZVK0gBUEIaikDACAEQQhqKQMAfHx8fCAYQjSIfHwiEEIMhiATQjSIhCADKQOAMiITIBdC/v///////weDfCIPfCISQv////////8HgzcDACABQSBqIgUgEUL///////8/gyAPIBJWrSAHQQhqKQMAIA8gE1StfCAQQjSIfHxCDIYgEkI0iIR8NwMAIAMgFUL/////////B4M3A/A6IAEgASAGECQgA0HQMGoiBiAJKQMAIg9CACADKQPwOiIRQgGGIhVCABBHIANBsDFqIgQgCCkDACISQgAgCykDACITQgGGIhdCABBHIANBwDBqIgcgBSkDACIQQgAgEEIAEEcgA0GwMGoiBSADKQPAMEIAQpD6gICAAkIAEEcgA0GQMGoiCCAQQgGGIhBCACARQgAQRyADQeAwaiIJIA9CACAXQgAQRyADQaAxaiIKIBJCACASQgAQRyADQaAwaiILIAdBCGopAwBCAEKAgMSegIDAAEIAEEcgA0HgMWoiByARQgAgEUIAEEcgA0GAMGoiDCAQQgAgE0IAEEcgA0HwMGoiDiAPQgAgEkIBhkIAEEcgAykD0DAiFCADKQOwMXwiESADKQOwMHwhFyARIBdWrSAFQQhqKQMAIBEgFFStIAZBCGopAwAgBEEIaikD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F1StIAlBCGopAwAgBUEIaikDAHx8IBBCNIh8fCIUQgyGIBFCNIiEIAMpA9AuIhYgAykDoC98Ig8gAykD8Cx8Ihd8IRAgA0GALGoiBiADKQPgLCIZIBVC/v///////weDfCIVIBAgF1StIA8gF1atIA5BCGopAwAgDyAWVK0gCkEIaikDACALQQhqKQMAfHx8fCAUQjSIfHwiGEIMhiAQQjSIhHwiFEL/////////B4MiD0IAIBNCAYZC/v///////w+DIhZCABBHIANB0CtqIgUgEEL/////////B4MiF0IAIBFCAYZC/v///////w+DIhpCABBHIANBoCtqIgcgEkL///////8/gyAUIBVUrSAEQQhqKQMAIBUgGVStfCAYQjSIfHxCDIYgFEI0iIR8IhJCACASQgAQRyADQZAraiIEIAMpA6ArQgBCkPqAgIACQgAQRyADQfAqaiIIIBNC/////////weDIhVCACASQgGGIhNCABBHIANBwCtqIgkgD0IAIBpCABBHIANBsCxqIgogF0IAIBdCABBHIANBgCtqIgsgB0EIaikDAEIAQoCAxJ6AgMAAQgAQRyADQZAsaiIHIBVCACAVQgAQRyADQeAqaiIMIBFC/////////weDIhFCACATQgAQRyADQbAraiIOIA9CACAQQgGGQv7///////8Pg0IAEEcgAykDgCwiFSADKQPQK3wiEiADKQOQK3whECAQIBJUrSAEQQhqKQMAIBIgFVStIAZBCGopAwAgBUEIaikDAHx8fHwiGUIMhiAQQjSIhCADKQPAKyIaIAMpA7AsfCIVIAMpA/AqfCIUIAMpA4ArfCIYfCESIANBgCpqIgUgEiAYVK0gFCAYVq0gC0EIaikDACAUIBVUrSAIQQhqKQMAIBUgGlStIAlBCGopAwAgCkEIaikDAHx8fHx8fCAZQjSIfHwiGEIMhiASQjSIhCADKQPgKiIZIAMpA7ArfCIVfCIUQgSGQvD/////////AIMgEkIwiEIPg4RCAELRh4CAEEIAEEcgA0HwK2oiBCARQgAgFkIAEEcgA0HQKmoiBiAXQgAgE0IAEEcgA0HALGoiCCAPQgAgD0IAEEcgA0HAKmoiCSAUIBVUrSAVIBlUrSAMQQhqKQMAIA5BCGopAwB8fCAYQjSIfHwiGEIMhiAUQjSIhCADKQPQKiIZIAMpA8AsfCIVfCIUQv////////8Hg0IAQpD6gICAAkIAEEcgA0HgK2oiCiAXQgAgFkIAEEcgA0GgLGoiCyARQgAgEUIAEEcgA0GwKmoiDCAPQgAgE0IAEEcgA0GgKmoiDiAUIBVUrSAVIBlUrSAGQQhqKQMAIAhBCGopAwB8fCAYQjSIfHwiD0IMhiAUQjSIhCITIAMpA7AqfCIRQgBCkPqAgIACQgAQRyADQZAqaiIIIBEgE1StIAxBCGopAwAgD0I0iHx8QgBCgIDEnoCAwABCABBHIAMpA4AqIhMgAykDkCx8IQ8gA0HIOmoiBkEIaiIMIA8gE1StIAVBCGopAwAgB0EIaikDAHx8IhdCDIYgD0I0iIQgAykDwCoiFSADKQPwK3wiE3wiEUL/////////B4M3AwAgBkEQaiIFIBEgE1StIBMgFVStIAlBCGopAwAgBEEIaikDAHx8IBdCNIh8fCIVQgyGIBFCNIiEIAMpA+ArIhQgAykDoCx8IhMgAykDoCp8IhF8IhdC/////////weDNwMAIAZBGGoiBCARIBdWrSARIBNUrSAOQQhqKQMAIBMgFFStIApBCGopAwAgC0EIaikDAHx8fHwgFUI0iHx8IhVCDIYgF0I0iIQgEEL+////////B4MgAykDkCoiEHwiE3wiEUL/////////B4M3AwAgBkEgaiIHIBJC////////P4MgESATVK0gCEEIaikDACAQIBNWrXwgFUI0iHx8QgyGIBFCNIiEfDcDACADIA9C/////////weDNwPIOiAGIAYgARAkIANB4ChqIgYgBCkDACIPQgAgAykDyDoiEUIBhiIVQgAQRyADQcApaiIEIAUpAwAiEkIAIAwpAwAiE0IBhiIXQgAQRyADQdAoaiIFIAcpAwAiEEIAIBBCABBHIANBwChqIgcgAykD0ChCAEKQ+oCAgAJCABBHIANBoChqIgggEEIBhiIQQgAgEUIAEEcgA0HwKGoiCSAPQgAgF0IAEEcgA0GwKWoiCiASQgAgEkIAEEcgA0GwKGoiCyAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANB8ClqIgUgEUIAIBFCABBHIANBkChqIgwgEEIAIBNCABBHIANBgClqIg4gD0IAIBJCAYZCABBHIAMpA+AoIhQgAykDwCl8IhEgAykDwCh8IRcgESAXVq0gB0EIaikDACARIBRUrSAGQQhqKQMAIARBCGopAwB8fHx8IhlCDIYgF0I0iIQgAykD8CgiGiADKQOwKXwiFCADKQOgKHwiFiADKQOwKHwiGHwhESADQYAoaiIGIBEgGFStIBYgGFatIAtBCGopAwAgFCAWVq0gCEEIaikDACAUIBpUrSAJQQhqKQMAIApBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEUI0iIQgAykDkCgiGSADKQOAKXwiFHwiFkIEhkLw/////////wCDIBFCMIhCD4OEQgBC0YeAgBBCABBHIANB4ClqIgQgE0IAIBVCABBHIANB4CdqIgcgEEIAIBJCABBHIANBkClqIgggD0IAIA9CABBHIANB0CdqIgkgFCAWVq0gFCAZVK0gDEEIaikDACAOQQhqKQMAfHwgGEI0iHx8IhhCDIYgFkI0iIQgAykD4CciGSADKQOQKXwiFHwiFkL/////////B4NCAEKQ+oCAgAJCABBHIANBoClqIgogEkIAIBVCABBHIANB0ClqIgsgE0IAIBNCABBHIANBoCdqIgwgEEIAIA9CABBHIANBkCdqIg4gFCAWVq0gFCAZVK0gB0EIaikDACAIQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFkI0iIQiEiADKQOgJ3wiE0IAQpD6gICAAkIAEEcgA0HQJmoiByASIBNWrSAMQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQOAKCIPIAMpA/ApfCESIA8gElatIAZBCGopAwAgBUEIaikDAHx8IhBCDIYgEkI0iIQgAykD0CciFSADKQPgKXwiD3whEyAPIBNWrSAPIBVUrSAJQQhqKQMAIARBCGopAwB8fCAQQjSIfHwiFEIMhiATQjSIhCADKQOgKSIWIAMpA9ApfCIPIAMpA5AnfCIVfCEQIANBwCZqIgYgECAVVK0gDyAVVq0gDkEIaikDACAPIBZUrSAKQQhqKQMAIAtBCGopAwB8fHx8IBRCNIh8fCIYQgyGIBBCNIiEIAMpA9AmIhkgF0L+////////B4N8IhV8IhRC/////////weDIg9CACASQgGGQv7///////8PgyIWQgAQRyADQYAnaiIFIBBC/////////weDIhdCACATQgGGQv7///////8PgyIaQgAQRyADQYAmaiIEIBFC////////P4MgFCAVVK0gB0EIaikDACAVIBlUrXwgGEI0iHx8QgyGIBRCNIiEfCIRQgAgEUIAEEcgA0HwJWoiByADKQOAJkIAQpD6gICAAkIAEEcgA0HQJWoiCCASQv////////8HgyISQgAgEUIBhiIRQgAQRyADQbAmaiIJIA9CACAaQgAQRyADQfAmaiIKIBdCACAXQgAQRyADQeAlaiILIARBCGopAwBCAEKAgMSegIDAAEIAEEcgA0HwJ2oiBCASQgAgEkIAEEcgA0HAJWoiDCATQv////////8HgyITQgAgEUIAEEcgA0GQJmoiDiAPQgAgEEIBhkL+////////D4NCABBHIAMpA8AmIhAgAykDgCd8IhIgAykD8CV8IRUgEiAVVq0gB0EIaikDACAQIBJWrSAGQQhqKQMAIAVBCGopAwB8fHx8IhlCDIYgFUI0iIQgAykDsCYiGiADKQPwJnwiECADKQPQJXwiFCADKQPgJXwiGHwhEiADQeAkaiIGIBIgGFStIBQgGFatIAtBCGopAwAgECAUVq0gCEEIaikDACAQIBpUrSAJQQhqKQMAIApBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEkI0iIQgAykDwCUiGSADKQOQJnwiEHwiFEIEhkLw/////////wCDIBJCMIhCD4OEQgBC0YeAgBBCABBHIANBwCdqIgUgE0IAIBZCABBHIANBsCVqIgcgF0IAIBFCABBHIANBoCZqIgggD0IAIA9CABBHIANBoCVqIgkgECAUVq0gECAZVK0gDEEIaikDACAOQQhqKQMAfHwgGEI0iHx8IhhCDIYgFEI0iIQgAykDsCUiGSADKQOgJnwiEHwiFEL/////////B4NCAEKQ+oCAgAJCABBHIANB4CZqIgogF0IAIBZCABBHIANBsCdqIgsgE0IAIBNCABBHIANBkCVqIgwgD0IAIBFCABBHIANBgCVqIg4gECAUVq0gECAZVK0gB0EIaikDACAIQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFEI0iIQiEyADKQOQJXwiEUIAQpD6gICAAkIAEEcgA0HwJGoiByARIBNUrSAMQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQPgJCIPIAMpA/AnfCETIA8gE1atIAZBCGopAwAgBEEIaikDAHx8IhBCDIYgE0I0iIQgAykDoCUiFyADKQPAJ3wiD3whESAPIBFWrSAPIBdUrSAJQQhqKQMAIAVBCGopAwB8fCAQQjSIfHwiFEIMhiARQjSIhCADKQPgJiIWIAMpA7AnfCIPIAMpA4AlfCIXfCEQIANBkCRqIgYgAykD8CQiGSAVQv7///////8Hg3wiFSAQIBdUrSAPIBdWrSAOQQhqKQMAIA8gFlStIApBCGopAwAgC0EIaikDAHx8fHwgFEI0iHx8IhhCDIYgEEI0iIR8IhRC/////////weDIg9CACATQgGGQv7///////8PgyIWQgAQRyADQeAjaiIFIBBC/////////weDIhdCACARQgGGQv7///////8PgyIaQgAQRyADQbAjaiIEIBJC////////P4MgFCAVVK0gB0EIaikDACAVIBlUrXwgGEI0iHx8QgyGIBRCNIiEfCISQgAgEkIAEEcgA0GgI2oiByADKQOwI0IAQpD6gICAAkIAEEcgA0GAI2oiCCATQv////////8HgyIVQgAgEkIBhiITQgAQRyADQdAjaiIJIA9CACAaQgAQRyADQcAkaiIKIBdCACAXQgAQRyADQZAjaiILIARBCGopAwBCAEKAgMSegIDAAEIAEEcgA0GgJGoiBCAVQgAgFUIAEEcgA0HwImoiDCARQv////////8HgyIRQgAgE0IAEEcgA0HAI2oiDiAPQgAgEEIBhkL+////////D4NCABBHIAMpA5AkIhUgAykD4CN8IhIgAykDoCN8IRAgECASVK0gB0EIaikDACASIBVUrSAGQQhqKQMAIAVBCGopAwB8fHx8IhlCDIYgEEI0iIQgAykD0CMiGiADKQPAJHwiFSADKQOAI3wiFCADKQOQI3wiGHwhEiADQZAiaiIFIBIgGFStIBQgGFatIAtBCGopAwAgFCAVVK0gCEEIaikDACAVIBpUrSAJQQhqKQMAIApBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEkI0iIQgAykD8CIiGSADKQPAI3wiFXwiFEIEhkLw/////////wCDIBJCMIhCD4OEQgBC0YeAgBBCABBHIANBgCRqIgcgEUIAIBZCABBHIANB4CJqIgYgF0IAIBNCABBHIANB0CRqIgggD0IAIA9CABBHIANB0CJqIgkgFCAVVK0gFSAZVK0gDEEIaikDACAOQQhqKQMAfHwgGEI0iHx8IhhCDIYgFEI0iIQgAykD4CIiGSADKQPQJHwiFXwiFEL/////////B4NCAEKQ+oCAgAJCABBHIANB8CNqIgogF0IAIBZCABBHIANBsCRqIgsgEUIAIBFCABBHIANBwCJqIgwgD0IAIBNCABBHIANBsCJqIg4gFCAVVK0gFSAZVK0gBkEIaikDACAIQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFEI0iIQiEyADKQPAInwiEUIAQpD6gICAAkIAEEcgA0GgImoiCCARIBNUrSAMQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQOQIiITIAMpA6AkfCEPIANBoDpqIgZBCGoiDCAPIBNUrSAFQQhqKQMAIARBCGopAwB8fCIXQgyGIA9CNIiEIAMpA9AiIhUgAykDgCR8IhN8IhFC/////////weDNwMAIAZBEGoiBSARIBNUrSATIBVUrSAJQQhqKQMAIAdBCGopAwB8fCAXQjSIfHwiFUIMhiARQjSIhCADKQPwIyIUIAMpA7AkfCITIAMpA7AifCIRfCIXQv////////8HgzcDACAGQRhqIgQgESAXVq0gESATVK0gDkEIaikDACATIBRUrSAKQQhqKQMAIAtBCGopAwB8fHx8IBVCNIh8fCIVQgyGIBdCNIiEIBBC/v///////weDIAMpA6AiIhB8IhN8IhFC/////////weDNwMAIAZBIGoiByASQv///////z+DIBEgE1StIAhBCGopAwAgECATVq18IBVCNIh8fEIMhiARQjSIhHw3AwAgAyAPQv////////8HgzcDoDogBiAGIAEQJCADQfAgaiIBIAQpAwAiD0IAIAMpA6A6IhFCAYYiFUIAEEcgA0HQIWoiBiAFKQMAIhJCACAMKQMAIhNCAYYiF0IAEEcgA0HgIGoiBSAHKQMAIhBCACAQQgAQRyADQdAgaiIEIAMpA+AgQgBCkPqAgIACQgAQRyADQbAgaiIHIBBCAYYiEEIAIBFCABBHIANBgCFqIgggD0IAIBdCABBHIANBwCFqIgkgEkIAIBJCABBHIANBwCBqIgogBUEIaikDAEIAQoCAxJ6AgMAAQgAQRyADQYAiaiIFIBFCACARQgAQRyADQaAgaiILIBBCACATQgAQRyADQZAhaiIMIA9CACASQgGGQgAQRyADKQPwICIUIAMpA9AhfCIRIAMpA9AgfCEXIBEgF1atIARBCGopAwAgESAUVK0gAUEIaikDACAGQQhqKQMAfHx8fCIZQgyGIBdCNIiEIAMpA4AhIhogAykDwCF8IhQgAykDsCB8IhYgAykDwCB8Ihh8IREgA0GQIGoiASARIBhUrSAWIBhWrSAKQQhqKQMAIBQgFlatIAdBCGopAwAgFCAaVK0gCEEIaikDACAJQQhqKQMAfHx8fHx8IBlCNIh8fCIYQgyGIBFCNIiEIAMpA6AgIhkgAykDkCF8IhR8IhZCBIZC8P////////8AgyARQjCIQg+DhEIAQtGHgIAQQgAQRyADQfAhaiIGIBNCACAVQgAQRyADQfAfaiIEIBBCACASQgAQRyADQaAhaiIHIA9CACAPQgAQRyADQeAfaiIIIBQgFlatIBQgGVStIAtBCGopAwAgDEEIaikDAHx8IBhCNIh8fCIYQgyGIBZCNIiEIAMpA/AfIhkgAykDoCF8IhR8IhZC/////////weDQgBCkPqAgIACQgAQRyADQbAhaiIJIBJCACAVQgAQRyADQeAhaiIKIBNCACATQgAQRyADQbAfaiILIBBCACAPQgAQRyADQaAfaiIMIBQgFlatIBQgGVStIARBCGopAwAgB0EIaikDAHx8IBhCNIh8fCIPQgyGIBZCNIiEIhIgAykDsB98IhNCAEKQ+oCAgAJCABBHIANB4B5qIgQgEiATVq0gC0EIaikDACAPQjSIfHxCAEKAgMSegIDAAEIAEEcgAykDkCAiDyADKQOAInwhEiAPIBJWrSABQQhqKQMAIAVBCGopAwB8fCIQQgyGIBJCNIiEIAMpA+AfIhUgAykD8CF8Ig98IRMgDyATVq0gDyAVVK0gCEEIaikDACAGQQhqKQMAfHwgEEI0iHx8IhRCDIYgE0I0iIQgAykDsCEiFiADKQPgIXwiDyADKQOgH3wiFXwhECADQdAeaiIBIBAgFVStIA8gFVatIAxBCGopAwAgDyAWVK0gCUEIaikDACAKQQhqKQMAfHx8fCAUQjSIfHwiGEIMhiAQQjSIhCADKQPgHiIZIBdC/v///////weDfCIVfCIUQv////////8HgyIPQgAgEkIBhkL+////////D4MiFkIAEEcgA0GQH2oiBiAQQv////////8HgyIXQgAgE0IBhkL+////////D4MiGkIAEEcgA0GQHmoiBSARQv///////z+DIBQgFVStIARBCGopAwAgFSAZVK18IBhCNIh8fEIMhiAUQjSIhHwiEUIAIBFCABBHIANBgB5qIgQgAykDkB5CAEKQ+oCAgAJCABBHIANB4B1qIgcgEkL/////////B4MiEkIAIBFCAYYiEUIAEEcgA0HAHmoiCCAPQgAgGkIAEEcgA0GAH2oiCSAXQgAgF0IAEEcgA0HwHWoiCiAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANBgCBqIgUgEkIAIBJCABBHIANB0B1qIgsgE0L/////////B4MiE0IAIBFCABBHIANBoB5qIgwgD0IAIBBCAYZC/v///////w+DQgAQRyADKQPQHiIVIAMpA5AffCISIAMpA4AefCEQIBAgElStIARBCGopAwAgEiAVVK0gAUEIaikDACAGQQhqKQMAfHx8fCIZQgyGIBBCNIiEIAMpA8AeIhogAykDgB98IhUgAykD4B18IhQgAykD8B18Ihh8IRIgA0HwHGoiBiASIBhUrSAUIBhWrSAKQQhqKQMAIBQgFVStIAdBCGopAwAgFSAaVK0gCEEIaikDACAJQQhqKQMAfHx8fHx8IBlCNIh8fCIYQgyGIBJCNIiEIAMpA9AdIhkgAykDoB58IhV8IhRCBIZC8P////////8AgyASQjCIQg+DhEIAQtGHgIAQQgAQRyADQdAfaiIEIBNCACAWQgAQRyADQcAdaiIBIBdCACARQgAQRyADQbAeaiIHIA9CACAPQgAQRyADQbAdaiIIIBQgFVStIBUgGVStIAtBCGopAwAgDEEIaikDAHx8IBhCNIh8fCIYQgyGIBRCNIiEIAMpA8AdIhkgAykDsB58IhV8IhRC/////////weDQgBCkPqAgIACQgAQRyADQfAeaiIJIBdCACAWQgAQRyADQcAfaiIKIBNCACATQgAQRyADQaAdaiILIA9CACARQgAQRyADQZAdaiIMIBQgFVStIBUgGVStIAFBCGopAwAgB0EIaikDAHx8IBhCNIh8fCIPQgyGIBRCNIiEIhMgAykDoB18IhFCAEKQ+oCAgAJCABBHIANBgB1qIgcgESATVK0gC0EIaikDACAPQjSIfHxCAEKAgMSegIDAAEIAEEcgAykD8BwiEyADKQOAIHwhDyADQfg5aiIBQQhqIgsg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CEEIaikDACANQQhqKQMAfHwgEkI0iHx8IhRCDIYgE0I0iIQgAykDkBkiFiADKQPAGXwiDyADKQPgF3wiEHwhEiAQIBJWrSAPIBBWrSAMQQhqKQMAIA8gFlStIAlBCGopAwAgCkEIaikDAHx8fHwgFEI0iHx8IhRCDIYgEkI0iIQgF0L+////////B4MgAykD0BciF3wiEHwhDyARQv///////z+DIA8gEFStIARBCGopAwAgECAXVK18IBRCNIh8fEIMhiAPQjSIhHwhECAPQv////////8HgyEPIBJC/////////weDIRIgE0L/////////B4MhEyAVQv////////8HgyERIAFBAWsiAQ0ACyADQag5aiIBQSBqIgYgEDcDACABQRhqIg0gDzcDACABQRBqIgUgEjcDACABQQhqIgQgEzcDACADIBE3A6g5IAEgASADQdA5ahAkIANBgDlqIgFBIGogBikDACIQNwMAIAFBGGogDSkDACIPNwMAIAFBEGogBSkDACISNwMAIAFBCGogBCkDACITNwMAIAMgAykDqDkiETcDgDlBLCEBA0AgA0GwF2oiBiAPQgAgEUIBhiIVQgAQRyADQeAWaiINIBJCACATQgGGIhdCABBHIANBoBZqIgUgEEIAIBBCABBHIANBkBZqIgQgAykDoBZCAEKQ+oCAgAJCABBHIANB8BVqIgcgEEIBhiIQQgAgEUIAEEcgA0GQF2oiCCAPQgAgF0IAEEcgA0HQFmoiCSASQgAgEkIAEEcgA0GAFmoiCiAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANBwBdqIgUgEUIAIBFCABBHIANB4BVqIgsgEEIAIBNCABBHIANBsBZqIgwgD0IAIBJCAYZCABBHIAMpA7AXIhQgAykD4BZ8IhEgAykDkBZ8IRcgESAXVq0gBEEIaikDACARIBRUrSAGQQhqKQMAIA1BCGopAwB8fHx8IhlCDIYgF0I0iIQgAykDkBciGiADKQPQFnwiFCADKQPwFXwiFiADKQOAFnwiGHwhESADQdAVaiIGIBEgGFStIBYgGFatIApBCGopAwAgFCAWVq0gB0EIaikDACAUIBpUrSAIQQhqKQMAIAlBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEUI0iIQgAykD4BUiGSADKQOwFnwiFHwiFkIEhkLw/////////wCDIBFCMIhCD4OEQgBC0YeAgBBCABBHIANBgBdqIg0gE0IAIBVCABBHIANBwBVqIgQgEEIAIBJCABBHIANBoBdqIgcgD0IAIA9CABBHIANBsBVqIgggFCAWVq0gFCAZVK0gC0EIaikDACAMQQhqKQMAfHwgGEI0iHx8IhhCDIYgFkI0iIQgAykDwBUiGSADKQOgF3wiFHwiFkL/////////B4NCAEKQ+oCAgAJCABBHIANBwBZqIgkgEkIAIBVCABBHIANB8BZqIgogE0IAIBNCABBHIANBoBVqIgsgEEIAIA9CABBHIANBkBVqIgwgFCAWVq0gFCAZVK0gBEEIaikDACAHQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFkI0iIQiEiADKQOgFXwiE0IAQpD6gICAAkIAEEcgA0GAFWoiBCASIBNWrSALQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQPQFSIPIAMpA8AXfCEVIA8gFVatIAZBCGopAwAgBUEIaikDAHx8IhJCDIYgFUI0iIQgAykDsBUiECADKQOAF3wiD3whEyAPIBNWrSAPIBBUrSAIQQhqKQMAIA1BCGopAwB8fCASQjSIfHwiFEIMhiATQjSIhCADKQPAFiIWIAMpA/AWfCIPIAMpA5AVfCIQfCESIBAgElatIA8gEFatIAxBCGopAwAgDyAWVK0gCUEIaikDACAKQQhqKQMAfHx8fCAUQjSIfHwiFEIMhiASQjSIhCAXQv7///////8HgyADKQOAFSIXfCIQfCEPIBFC////////P4MgDyAQVK0gBEEIaikDACAQIBdUrXwgFEI0iHx8QgyGIA9CNIiEfCEQIA9C/////////weDIQ8gEkL/////////B4MhEiATQv////////8HgyETIBVC/////////weDIREgAUEBayIBDQALIANBgDlqIgFBIGoiBiAQNwMAIAFBGGoiDSAPNwMAIAFBEGoiBSASNwMAIAFBCGoiBCATNwMAIAMgETcDgDkgASABIANBqDlqECQgA0HYOGoiAUEgaiAGKQMAIhA3AwAgAUEYaiANKQMAIg83AwAgAUEQaiAFKQMAIhI3AwAgAUEIaiAEKQMAIhM3AwAgAyADKQOAOSIRNwPYOEHYACEBA0AgA0HgFGoiBiAPQgAgEUIBhiIVQgAQRyADQZAUaiINIBJCACATQgGGIhdCABBHIANB0BNqIgUgEEIAIBBCABBHIANBwBNqIgQgAykD0BNCAEKQ+oCAgAJCABBHIANBoBNqIgcgEEIBhiIQQgAgEUIAEEcgA0HAFGoiCCAPQgAgF0IAEEcgA0GAFGoiCSASQgAgEkIAEEcgA0GwE2oiCiAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANB8BRqIgUgEUIAIBFCABBHIANBkBNqIgsgEEIAIBNCABBHIANB4BNqIgwgD0IAIBJCAYZCABBHIAMpA+AUIhQgAykDkBR8IhEgAykDwBN8IRcgESAXVq0gBEEIaikDACARIBRUrSAGQQhqKQMAIA1BCGopAwB8fHx8IhlCDIYgF0I0iIQgAykDwBQiGiADKQOAFHwiFCADKQOgE3wiFiADKQOwE3wiGHwhESADQYATaiIGIBEgGFStIBYgGFatIApBCGopAwAgFCAWVq0gB0EIaikDACAUIBpUrSAIQQhqKQMAIAlBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEUI0iIQgAykDkBMiGSADKQPgE3wiFHwiFkIEhkLw/////////wCDIBFCMIhCD4OEQgBC0YeAgBBCABBHIANBsBRqIg0gE0IAIBVCABBHIANB8BJqIgQgEEIAIBJCABBHIANB0BRqIgcgD0IAIA9CABBHIANB4BJqIgggFCAWVq0gFCAZVK0gC0EIaikDACAMQQhqKQMAfHwgGEI0iHx8IhhCDIYgFkI0iIQgAykD8BIiGSADKQPQFHwiFHwiFkL/////////B4NCAEKQ+oCAgAJCABBHIANB8BNqIgkgEkIAIBVCABBHIANBoBRqIgogE0IAIBNCABBHIANB0BJqIgsgEEIAIA9CABBHIANBwBJqIgwgFCAWVq0gFCAZVK0gBEEIaikDACAHQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFkI0iIQiEiADKQPQEnwiE0IAQpD6gICAAkIAEEcgA0GwEmoiBCASIBNWrSALQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQOAEyIPIAMpA/AUfCEVIA8gFVatIAZBCGopAwAgBUEIaikDAHx8IhJCDIYgFUI0iIQgAykD4BIiECADKQOwFHwiD3whEyAPIBNWrSAPIBBUrSAIQQhqKQMAIA1BCGopAwB8fCASQjSIfHwiFEIMhiATQjSIhCADKQPwEyIWIAMpA6AUfCIPIAMpA8ASfCIQfCESIBAgElatIA8gEFatIAxBCGopAwAgDyAWVK0gCUEIaikDACAKQQhqKQMAfHx8fCAUQjSIfHwiFEIMhiASQjSIhCAXQv7///////8HgyADKQOwEiIXfCIQfCEPIBFC////////P4MgDyAQVK0gBEEIaikDACAQIBdUrXwgFEI0iHx8QgyGIA9CNIiEfCEQIA9C/////////weDIQ8gEkL/////////B4MhEiATQv////////8HgyETIBVC/////////weDIREgAUEBayIBDQALIANB2DhqIgFBIGoiBiAQNwMAIAFBGGoiDSAPNwMAIAFBEGoiBSASNwMAIAFBCGoiBCATNwMAIAMgETcD2DggASABIANBgDlqECQgA0GwOGoiAUEgaiAGKQMAIhA3AwAgAUEYaiANKQMAIg83AwAgAUEQaiAFKQMAIhI3AwAgAUEIaiAEKQMAIhM3AwAgAyADKQPYOCIRNwOwOEEsIQEDQCADQZASaiIGIA9CACARQgGGIhVCABBHIANBwBFqIg0gEkIAIBNCAYYiF0IAEEcgA0GAEWoiBSAQQgAgEEIAEEcgA0HwEGoiBCADKQOAEUIAQpD6gICAAkIAEEcgA0HQEGoiByAQQgGGIhBCACARQgAQRyADQfARaiIIIA9CACAXQgAQRyADQbARaiIJIBJCACASQgAQRyADQeAQaiIKIAVBCGopAwBCAEKAgMSegIDAAEIAEEcgA0GgEmoiBSARQgAgEUIAEEcgA0HAEGoiCyAQQgAgE0IAEEcgA0GQEWoiDCAPQgAgEkIBhkIAEEcgAykDkBIiFCADKQPAEXwiESADKQPwEHwhFyARIBdWrSAEQQhqKQMAIBEgFFStIAZBCGopAwAgDUEIaikDAHx8fHwiGUIMhiAXQjSIhCADKQPwESIaIAMpA7ARfCIUIAMpA9AQfCIWIAMpA+AQfCIYfCERIANBsBBqIgYgESAYVK0gFiAYVq0gCkEIaikDACAUIBZWrSAHQQhqKQMAIBQgGlStIAhBCGopAwAgCUEIaikDAHx8fHx8fCAZQjSIfHwiGEIMhiARQjSIhCADKQPAECIZIAMpA5ARfCIUfCIWQgSGQvD/////////AIMgEUIwiEIPg4RCAELRh4CAEEIAEEcgA0HgEWoiDSATQgAgFUIAEEcgA0GgEGoiBCAQQgAgEkIAEEcgA0GAEmoiByAPQgAgD0IAEEcgA0GQEGoiCCAUIBZWrSAUIBlUrSALQQhqKQMAIAxBCGopAwB8fCAYQjSIfHwiGEIMhiAWQjSIhCADKQOgECIZIAMpA4ASfCIUfCIWQv////////8Hg0IAQpD6gICAAkIAEEcgA0GgEWoiCSASQgAgFUIAEEcgA0HQEWoiCiATQgAgE0IAEEcgA0GAEGoiCyAQQgAgD0IAEEcgA0HwD2oiDCAUIBZWrSAUIBlUrSAEQQhqKQMAIAdBCGopAwB8fCAYQjSIfHwiD0IMhiAWQjSIhCISIAMpA4AQfCITQgBCkPqAgIACQgAQRyADQeAPaiIEIBIgE1atIAtBCGopAwAgD0I0iHx8QgBCgIDEnoCAwABCABBHIAMpA7AQIg8gAykDoBJ8IRUgDyAVVq0gBkEIaikDACAFQQhqKQMAfHwiEkIMhiAVQjSIhCADKQOQECIQIAMpA+ARfCIPfCETIA8gE1atIA8gEFStIAhBCGopAwAgDUEIaikDAHx8IBJCNIh8fCIUQgyGIBNCNIiEIAMpA6ARIhYgAykD0BF8Ig8gAykD8A98IhB8IRIgECASVq0gDyAQVq0gDEEIaikDACAPIBZUrSAJQQhqKQMAIApBCGopAwB8fHx8IBRCNIh8fCIUQgyGIBJCNIiEIBdC/v///////weDIAMpA+APIhd8IhB8IQ8gEUL///////8/gyAPIBBUrSAEQQhqKQMAIBAgF1StfCAUQjSIfHxCDIYgD0I0iIR8IRAgD0L/////////B4MhDyASQv////////8HgyESIBNC/////////weDIRMgFUL/////////B4MhESABQQFrIgENAAsgA0GwOGoiAUEgaiIGIBA3AwAgAUEYaiINIA83AwAgAUEQaiIFIBI3AwAgAUEIaiIEIBM3AwAgAyARNwOwOCABIAEgA0GoOWoQJCADQcAOaiIBIA0pAwAiD0IAIAMpA7A4IhFCAYYiFUIAEEcgA0GgD2oiDSAFKQMAIhJCACAEKQMAIhNCAYYiF0IAEEcgA0GwDmoiBSAGKQMAIhBCACAQQgAQRyADQaAOaiIGIAMpA7AOQgBCkPqAgIACQgAQRyADQYAOaiIEIBBCAYYiEEIAIBFCABBHIANB0A5qIgcgD0IAIBdCABBHIANBkA9qIgggEkIAIBJCABBHIANBkA5qIgkgBUEIaikDAEIAQoCAxJ6AgMAAQgAQRyADQdAPaiIFIBFCACARQgAQRyADQfANaiIKIBBCACATQgAQRyADQeAOaiILIA9CACASQgGGQgAQRyADKQPADiIUIAMpA6APfCIRIAMpA6AOfCEXIBEgF1atIAZBCGopAwAgESAUVK0gAUEIaikDACANQQhqKQMAfHx8fCIZQgyGIBdCNIiEIAMpA9AOIhogAykDkA98IhQgAykDgA58IhYgAykDkA58Ihh8IREgA0HgDWoiASARIBhUrSAWIBhWrSAJQQhqKQMAIBQgFlatIARBCGopAwAgFCAaVK0gB0EIaikDACAIQQhqKQMAfHx8fHx8IBlCNIh8fCIYQgyGIBFCNIiEIAMpA/ANIhkgAykD4A58IhR8IhZCBIZC8P////////8AgyARQjCIQg+DhEIAQtGHgIAQQgAQRyADQcAPaiIGIBNCACAVQgAQRyADQcANaiINIBBCACASQgAQRyADQfAOaiIEIA9CACAPQgAQRyADQbANaiIHIBQgFlatIBQgGVStIApBCGopAwAgC0EIaikDAHx8IBhCNIh8fCIYQgyGIBZCNIiEIAMpA8ANIhkgAykD8A58IhR8IhZC/////////weDQgBCkPqAgIACQgAQRyADQYAPaiIIIBJCACAVQgAQRyADQbAPaiIJIBNCACATQgAQRyADQYANaiIKIBBCACAPQgAQRyADQfAMaiILIBQgFlatIBQgGVStIA1BCGopAwAgBEEIaikDAHx8IBhCNIh8fCIPQgyGIBZCNIiEIhIgAykDgA18IhNCAEKQ+oCAgAJCABBHIANBsAxqIg0gEiATVq0gCkEIaikDACAPQjSIfHxCAEKAgMSegIDAAEIAEEcgAykD4A0iDyADKQPQD3whEiAPIBJWrSABQQhqKQMAIAVBCGopAwB8fCIQQgyGIBJCNIiEIAMpA7ANIhUgAykDwA98Ig98IRMgDyATVq0gDyAVVK0gB0EIaikDACAGQQhqKQMAfHwgEEI0iHx8IhRCDIYgE0I0iIQgAykDgA8iFiADKQOwD3wiDyADKQPwDHwiFXwhECADQaAMaiIBIBAgFVStIA8gFVatIAtBCGopAwAgDyAWVK0gCEEIaikDACAJQQhqKQMAfHx8fCAUQjSIfHwiGEIMhiAQQjSIhCADKQOwDCIZIBdC/v///////weDfCIVfCIUQv////////8HgyIPQgAgEkIBhkL+////////D4MiFkIAEEcgA0HgDGoiBiAQQv////////8HgyIXQgAgE0IBhkL+////////D4MiGkIAEEcgA0HgC2oiBSARQv///////z+DIBQgFVStIA1BCGopAwAgFSAZVK18IBhCNIh8fEIMhiAUQjSIhHwiEUIAIBFCABBHIANB0AtqIg0gAykD4AtCAEKQ+oCAgAJCABBHIANBsAtqIgQgEkL/////////B4MiEkIAIBFCAYYiEUIAEEcgA0GQDGoiByAPQgAgGkIAEEcgA0HQDGoiCCAXQgAgF0IAEEcgA0HAC2oiCSAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANB0A1qIgUgEkIAIBJCABBHIANBoAtqIgogE0L/////////B4MiE0IAIBFCABBHIANB8AtqIgsgD0IAIBBCAYZC/v///////w+DQgAQRyADKQOgDCIQIAMpA+AMfCISIAMpA9ALfCEVIBIgFVatIA1BCGopAwAgECASVq0gAUEIaikDACAGQQhqKQMAfHx8fCIZQgyGIBVCNIiEIAMpA5AMIhogAykD0Ax8IhAgAykDsAt8IhQgAykDwAt8Ihh8IRIgA0HACmoiASASIBhUrSAUIBhWrSAJQQhqKQMAIBAgFFatIARBCGopAwAgECAaVK0gB0EIaikDACAIQQhqKQMAfHx8fHx8IBlCNIh8fCIYQgyGIBJCNIiEIAMpA6ALIhkgAykD8At8IhB8IhRCBIZC8P////////8AgyASQjCIQg+DhEIAQtGHgIAQQgAQRyADQaANaiIGIBNCACAWQgAQRyADQZALaiINIBdCACARQgAQRyADQYAMaiIEIA9CACAPQgAQRyADQYALaiIHIBAgFFatIBAgGVStIApBCGopAwAgC0EIaikDAHx8IBhCNIh8fCIYQgyGIBRCNIiEIAMpA5ALIhkgAykDgAx8IhB8IhRC/////////weDQgBCkPqAgIACQgAQRyADQcAMaiIIIBdCACAWQgAQRyADQZANaiIJIBNCACATQgAQRyADQfAKaiIKIA9CACARQgAQRyADQeAKaiILIBAgFFatIBAgGVStIA1BCGopAwAgBEEIaikDAHx8IBhCNIh8fCIPQgyGIBRCNIiEIhMgAykD8Ap8IhFCAEKQ+oCAgAJCABBHIANB0ApqIg0gESATVK0gCkEIaikDACAPQjSIfHxCAEKAgMSegIDAAEIAEEcgAykDwAoiDyADKQPQDXwhEyAPIBNWrSABQQhqKQMAIAVBCGopAwB8fCIQQgyGIBNCNIiEIAMpA4ALIhcgAykDoA18Ig98IREgDyARVq0gDyAXVK0gB0EIaikDACAGQQhqKQMAfHwgEEI0iHx8IhRCDIYgEUI0iIQgAykDwAwiFiADKQOQDXwiDyADKQPgCnwiF3whECADQfAJaiIBIAMpA9AKIhkgFUL+////////B4N8IhUgECAXVK0gDyAXVq0gC0EIaikDACAPIBZUrSAIQQhqKQMAIAlBCGopAwB8fHx8IBRCNIh8fCIYQgyGIBBCNIiEfCIUQv////////8HgyIPQgAgE0IBhkL+////////D4MiFkIAEEcgA0HACWoiBiAQQv////////8HgyIXQgAgEUIBhkL+////////D4MiGkIAEEcgA0GQCWoiBSASQv///////z+DIBQgFVStIA1BCGopAwAgFSAZVK18IBhCNIh8fEIMhiAUQjSIhHwiEkIAIBJCABBHIANBgAlqIg0gAykDkAlCAEKQ+oCAgAJCABBHIANB4AhqIgQgE0L/////////B4MiFUIAIBJCAYYiE0IAEEcgA0GwCWoiByAPQgAgGkIAEEcgA0GgCmoiCCAXQgAgF0IAEEcgA0HwCGoiCSAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANBgApqIgUgFUIAIBVCABBHIANB0AhqIgogEUL/////////B4MiEUIAIBNCABBHIANBoAlqIgsgD0IAIBBCAYZC/v///////w+DQgAQRyADKQPwCSIVIAMpA8AJfCISIAMpA4AJfCEQIBAgElStIA1BCGopAwAgEiAVVK0gAUEIaikDACAGQQhqKQMAfHx8fCIZQgyGIBBCNIiEIAMpA7AJIhogAykDoAp8IhUgAykD4Ah8IhQgAykD8Ah8Ihh8IRIgA0HwB2oiBiASIBhUrSAUIBhWrSAJQQhqKQMAIBQgFVStIARBCGopAwAgFSAaVK0gB0EIaikDACAIQQhqKQMAfHx8fHx8IBlCNIh8fCIYQgyGIBJCNIiEIAMpA9AIIhkgAykDoAl8IhV8IhRCBIZC8P////////8AgyASQjCIQg+DhEIAQtGHgIAQQgAQRyADQeAJaiINIBFCACAWQgAQRyADQcAIaiIBIBdCACATQgAQRyADQbAKaiIEIA9CACAPQgAQRyADQbAIaiIHIBQgFVStIBUgGVStIApBCGopAwAgC0EIaikDAHx8IBhCNIh8fCIYQgyGIBRCNIiEIAMpA8AIIhkgAykDsAp8IhV8IhRC/////////weDQgBCkPqAgIACQgAQRyADQdAJaiIIIBdCACAWQgAQRyADQZAKaiIJIBFCACARQgAQRyADQaAIaiIKIA9CACATQgAQRyADQZAIaiILIBQgFVStIBUgGVStIAFBCGopAwAgBEEIaikDAHx8IBhCNIh8fCIPQgyGIBRCNIiEIhMgAykDoAh8IhFCAEKQ+oCAgAJCABBHIANBgAhqIgQgESATVK0gCkEIaikDACAPQjSIfHxCAEKAgMSegIDAAEIAEEcgAykD8AciEyADKQOACnwhDyADQYg4aiIBQQhqIgogDyATVK0gBkEIaikDACAFQQhqKQMAfHwiF0IMhiAPQjSIhCADKQOwCCIVIAMpA+AJfCITfCIRQv////////8HgzcDACABQRBqIgYgESATVK0gEyAVVK0gB0EIaikDACANQQhqKQMAfHwgF0I0iHx8IhVCDIYgEUI0iIQgAykD0AkiFCADKQOQCnwiEyADKQOQCHwiEXwiF0L/////////B4M3AwAgAUEYaiINIBEgF1atIBEgE1StIAtBCGopAwAgEyAUVK0gCEEIaikDACAJQQhqKQMAfHx8fCAVQjSIfHwiFUIMhiAXQjSIhCAQQv7///////8HgyADKQOACCIQfCITfCIRQv////////8HgzcDACABQSBqIgUgEkL///////8/gyARIBNUrSAEQQhqKQMAIBAgE1atfCAVQjSIfHxCDIYgEUI0iIR8NwMAIAMgD0L/////////B4M3A4g4IAEgASADQfA6ahAkIANB4DdqIgFBIGogBSkDACIQNwMAIAFBGGogDSkDACIPNwMAIAFBEGogBikDACISNwMAIAFBCGogCikDACITNwMAIAMgAykDiDgiETcD4DdBFyEBA0AgA0HQB2oiBiAPQgAgEUIBhiIVQgAQRyADQYAHaiINIBJCACATQgGGIhdCABBHIANBwAZqIgUgEEIAIBBCABBHIANBsAZqIgQgAykDwAZCAEKQ+oCAgAJCABBHIANBkAZqIgcgEEIBhiIQQgAgEUIAEEcgA0GwB2oiCCAPQgAgF0IAEEcgA0HwBmoiCSASQgAgEkIAEEcgA0GgBmoiCiAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANB4AdqIgUgEUIAIBFCABBHIANBgAZqIgsgEEIAIBNCABBHIANB0AZqIgwgD0IAIBJCAYZCABBHIAMpA9AHIhQgAykDgAd8IhEgAykDsAZ8IRcgESAXVq0gBEEIaikDACARIBRUrSAGQQhqKQMAIA1BCGopAwB8fHx8IhlCDIYgF0I0iIQgAykDsAciGiADKQPwBnwiFCADKQOQBnwiFiADKQOgBnwiGHwhESADQfAFaiIGIBEgGFStIBYgGFatIApBCGopAwAgFCAWVq0gB0EIaikDACAUIBpUrSAIQQhqKQMAIAlBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEUI0iIQgAykDgAYiGSADKQPQBnwiFHwiFkIEhkLw/////////wCDIBFCMIhCD4OEQgBC0YeAgBBCABBHIANBoAdqIg0gE0IAIBVCABBHIANB4AVqIgQgEEIAIBJCABBHIANBwAdqIgcgD0IAIA9CABBHIANB0AVqIgggFCAWVq0gFCAZVK0gC0EIaikDACAMQQhqKQMAfHwgGEI0iHx8IhhCDIYgFkI0iIQgAykD4AUiGSADKQPAB3wiFHwiFkL/////////B4NCAEKQ+oCAgAJCABBHIANB4AZqIgkgEkIAIBVCABBHIANBkAdqIgogE0IAIBNCABBHIANBwAVqIgsgEEIAIA9CABBHIANBsAVqIgwgFCAWVq0gFCAZVK0gBEEIaikDACAHQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFkI0iIQiEiADKQPABXwiE0IAQpD6gICAAkIAEEcgA0GgBWoiBCASIBNWrSALQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQPwBSIPIAMpA+AHfCEVIA8gFVatIAZBCGopAwAgBUEIaikDAHx8IhJCDIYgFUI0iIQgAykD0AUiECADKQOgB3wiD3whEyAPIBNWrSAPIBBUrSAIQQhqKQMAIA1BCGopAwB8fCASQjSIfHwiFEIMhiATQjSIhCADKQPgBiIWIAMpA5AHfCIPIAMpA7AFfCIQfCESIBAgElatIA8gEFatIAxBCGopAwAgDyAWVK0gCUEIaikDACAKQQhqKQMAfHx8fCAUQjSIfHwiFEIMhiASQjSIhCAXQv7///////8HgyADKQOgBSIXfCIQfCEPIBFC////////P4MgDyAQVK0gBEEIaikDACAQIBdUrXwgFEI0iHx8QgyGIA9CNIiEfCEQIA9C/////////weDIQ8gEkL/////////B4MhEiATQv////////8HgyETIBVC/////////weDIREgAUEBayIBDQALIAMgEDcDgDggAyAPNwP4NyADIBI3A/A3IAMgEzcD6DcgAyARNwPgNyADQeA3aiIBIAEgA0HQOWoQJEEGIQEgAykDgDghECADKQP4NyEPIAMpA/A3IRIgAykD6DchEyADKQPgNyERA0AgA0GABWoiBiAPQgAgEUIBhiIVQgAQRyADQbAEaiINIBJCACATQgGGIhdCABBHIANB8ANqIgUgEEIAIBBCABBHIANB4ANqIgQgAykD8ANCAEKQ+oCAgAJCABBHIANBwANqIgcgEEIBhiIQQgAgEUIAEEcgA0HgBGoiCCAPQgAgF0IAEEcgA0GgBGoiCSASQgAgEkIAEEcgA0HQA2oiCiAFQQhqKQMAQgBCgIDEnoCAwABCABBHIANBkAVqIgUgEUIAIBFCABBHIANBsANqIgsgEEIAIBNCABBHIANBgARqIgwgD0IAIBJCAYZCABBHIAMpA4AFIhQgAykDsAR8IhEgAykD4AN8IRcgESAXVq0gBEEIaikDACARIBRUrSAGQQhqKQMAIA1BCGopAwB8fHx8IhlCDIYgF0I0iIQgAykD4AQiGiADKQOgBHwiFCADKQPAA3wiFiADKQPQA3wiGHwhESADQaADaiIGIBEgGFStIBYgGFatIApBCGopAwAgFCAWVq0gB0EIaikDACAUIBpUrSAIQQhqKQMAIAlBCGopAwB8fHx8fHwgGUI0iHx8IhhCDIYgEUI0iIQgAykDsAMiGSADKQOABHwiFHwiFkIEhkLw/////////wCDIBFCMIhCD4OEQgBC0YeAgBBCABBHIANB0ARqIg0gE0IAIBVCABBHIANBkANqIgQgEEIAIBJCABBHIANB8ARqIgcgD0IAIA9CABBHIANBgANqIgggFCAWVq0gFCAZVK0gC0EIaikDACAMQQhqKQMAfHwgGEI0iHx8IhhCDIYgFkI0iIQgAykDkAMiGSADKQPwBHwiFHwiFkL/////////B4NCAEKQ+oCAgAJCABBHIANBkARqIgkgEkIAIBVCABBHIANBwARqIgogE0IAIBNCABBHIANB8AJqIgsgEEIAIA9CABBHIANB4AJqIgwgFCAWVq0gFCAZVK0gBEEIaikDACAHQQhqKQMAfHwgGEI0iHx8Ig9CDIYgFkI0iIQiEiADKQPwAnwiE0IAQpD6gICAAkIAEEcgA0HQAmoiBCASIBNWrSALQQhqKQMAIA9CNIh8fEIAQoCAxJ6AgMAAQgAQRyADKQOgAyIPIAMpA5AFfCEVIA8gFVatIAZBCGopAwAgBUEIaikDAHx8IhJCDIYgFUI0iIQgAykDgAMiECADKQPQBHwiD3whEyAPIBNWrSAPIBBUrSAIQQhqKQMAIA1BCGopAwB8fCASQjSIfHwiFEIMhiATQjSIhCADKQOQBCIWIAMpA8AEfCIPIAMpA+ACfCIQfCESIBAgElatIA8gEFatIAxBCGopAwAgDyAWVK0gCUEIaikDACAKQQhqKQMAfHx8fCAUQjSIfHwiFEIMhiASQjSIhCAXQv7///////8HgyADKQPQAiIXfCIQfCEPIBFC////////P4MgDyAQVK0gBEEIaikDACAQIBdUrXwgFEI0iHx8QgyGIA9CNIiEfCEQIA9C/////////weDIQ8gEkL/////////B4MhEiATQv////////8HgyETIBVC/////////weDIREgAUEBayIBDQALIAMgEDcDgDggAyAPNwP4NyADIBI3A/A3IAMgEzcD6DcgAyARNwPgNyADQeA3aiIBIAEgA0GYO2oQJCADQUBrIgYgAykD+DciD0IAIAMpA+A3IhFCAYYiFUIAEEcgA0GQAmoiDSADKQPwNyISQgAgAykD6DciE0IBhiIXQgAQRyADQeABaiIFIAMpA4A4IhBCACAQQgAQRyADQdABaiIEIAMpA+ABQgBCkPqAgIACQgAQRyADQbABaiIHIBBCAYYiEEIAIBFCABBHIANB0ABqIgggD0IAIBdCABBHIANBgAJqIgkgEkIAIBJCABBHIANBwAFqIgogBUEIaikDAEIAQoCAxJ6AgMAAQgAQRyADQcACaiIFIBFCACARQgAQRyADQaABaiILIBBCACATQgAQRyADQeAAaiIMIA9CACASQgGGQgAQRyADKQNAIhQgAykDkAJ8IhEgAykD0AF8IRcgESAXVq0gBEEIaikDACARIBRUrSAGQQhqKQMAIA1BCGopAwB8fHx8IhlCDIYgF0I0iIQgAykDUCIaIAMpA4ACfCIUIAMpA7ABfCIWIAMpA8ABfCIYfCERIAMgESAYVK0gFiAYVq0gCkEIaikDACAUIBZWrSAHQQhqKQMAIBQgGlStIAhBCGopAwAgCUEIaikDAHx8fHx8fCAZQjSIfHwiGUIMhiARQjSIhCADKQOgASIaIAMpA2B8IhR8IhZCBIZC8P////////8AgyARQjCIQg+DhEIAQtGHgIAQQgAQRyADIAMpAwAiGyADKQPAAnwiGEL/////////B4M3A+A3IANBsAJqIgYgE0IAIBVCABBHIANBkAFqIg0gEEIAIBJCABBHIANB8ABqIgQgD0IAIA9CABBHIANBMGoiByAUIBZWrSAUIBpUrSALQQhqKQMAIAxBCGopAwB8fCAZQjSIfHwiGkIMhiAWQjSIhCADKQOQASIcIAMpA3B8IhR8IhZC/////////weDQgBCkPqAgIACQgAQRyADIBggG1StIANBCGopAwAgBUEIaikDAHx8IhtCDIYgGEI0iIQgAykDMCIdIAMpA7ACfCIYfCIZQv////////8HgzcD6DcgA0HwAWoiBSASQgAgFUIAEEcgA0GgAmoiCCATQgAgE0IAEEcgA0GAAWoiCSAQQgAgD0IAEEcgA0EgaiIKIBQgFlatIBQgHFStIA1BCGopAwAgBEEIaikDAHx8IBpCNIh8fCIQQgyGIBZCNIiEIhUgAykDgAF8IhRCAEKQ+oCAgAJCABBHIAMgGCAZVq0gGCAdVK0gB0EIaikDACAGQQhqKQMAfHwgG0I0iHx8IhZCDIYgGUI0iIQgAykD8AEiGCADKQOgAnwiDyADKQMgfCISfCITQv////////8HgzcD8DcgA0EQaiIGIBQgFVStIAlBCGopAwAgEEI0iHx8QgBCgIDEnoCAwABCABBHIAMgEiATVq0gDyASVq0gCkEIaikDACAPIBhUrSAFQQhqKQMAIAhBCGopAwB8fHx8IBZCNIh8fCIQQgyGIBNCNIiEIAMpAxAiEyAXQv7///////8Hg3wiD3wiEkL/////////B4M3A/g3IAMgEUL///////8/gyAPIBJWrSAGQQhqKQMAIA8gE1StfCAQQjSIfHxCDIYgEkI0iIR8NwOAOCAAQShqIgYgARA4IAEgBhA4IAMpA6g3IAMpA/g3fSADKQOgNyADKQPwN30gAykDmDcgAykD6Dd9IAMpA5A3IAMpA+A3fSADKQOwNyADKQOAOH1C/P///////wF8IhBCMIhC0YeAgBB+fEK84f//v///H3wiEkI0iHxC/P///////x98IhNCNIh8Qvz///////8ffCIRQjSIfEL8////////H3whDwJAIBBC////////P4MgD0I0iHwiECASIBOEIBGEIA+EQv////////8Hg4RCAFIEQEEAIQEgEkLQh4CAEIUgEEKAgICAgIDAB4WDIBODIBGDIA+DQv////////8HUg0BCyAAQTBqKQMAIAApAyggAEHIAGopAwAiF0IwiELRh4CAEH58IhVCNIh8Ig9C/////////weDIRMgAEFAaykDACAAQThqKQMAIA9CNIh8IhBCNIh8IhJC/////////weDIREgDyAQQv////////8HgyIQgyASg0L/////////B1EgF0L///////8/gyASQjSIfCIPQv///////z9RcSAVQv////////8HgyISQq74///v//8HVnGtIA9CMIiEQgBSBEAgEkLRh4CAEHwiF0L/////////B4MhEiATIBdCNIh8IhdC/////////weDIRMgECAXQjSIfCIXQv////////8HgyEQIBEgF0I0iHwiF0L/////////B4MhESAXQjSIIA98Qv///////z+DIQ8LIAAgDzcDSCAAIBE3A0AgACAQNwM4IAAgEzcDMCAAIBI3AyhBASEBIBKnQQFxIAJGDQAgAEL8////////ASAPfTcDSCAAQvz///////8fIBF9NwNAIABC/P///////x8gEH03AzggAEL8////////HyATfTcDMCAAQrzh//+///8fIBJ9NwMoCyADQcA7aiQAIAEL7gwCD38WfiMAQfADayIDJAAgA0FAayIFIAIpAxgiFEIAIAEpAwAiFUIAEEcgA0HQAWoiBiACKQMQIhdCACABKQMIIhhCABBHIANBwAJqIgcgAikDCCIbQgAgASkDECIdQgAQRyADQZADaiIIIAIpAwAiHkIAIAEpAxgiH0IAEEcgA0HgA2oiBCACKQMgIiBCACABKQMgIiFCABBHIANB0ANqIgEgAykD4ANCAEKQ+oCAgAJCABBHIANB0ABqIgIgIEIAIBVCABBHIANBkAFqIgkgFEIAIBhCABBHIANBkAJqIgogF0IAIB1CABBHIANB8AJqIgsgG0IAIB9CABBHIANBsANqIgwgHkIAICFCABBHIANBwANqIg0gBEEIaikDAEIAQoCAxJ6AgMAAQgAQRyADQeAAaiIEIB5CACAVQgAQRyADQeABaiIOICBCACAYQgAQRyADQaABaiIPIBRCACAdQgAQRyADQaACaiIQIBdCACAfQgAQRyADQYADaiIRIBtCACAhQgAQRyADKQPQASIWIAMpA0B8IhwgAykDwAJ8IhIgAykDkAN8IhMgAykD0AN8IiUgE1StIAFBCGopAwAgEiATVq0gCEEIaikDACASIBxUrSAHQQhqKQMAIBYgHFatIAZBCGopAwAgBUEIaikDAHx8fHx8fHx8IiJCDIYgJUI0iIQgAykDkAIiIyADKQOQAXwiEiADKQPwAnwiEyADKQOwA3wiFiADKQNQfCIZIAMpA8ADfCIafCEcIAMgGiAcVq0gGSAaVq0gDUEIaikDACAWIBlWrSACQQhqKQMAIBMgFlatIAxBCGopAwAgEiATVq0gC0EIaikDACASICNUrSAKQQhqKQMAIAlBCGopAwB8fHx8fHx8fHx8ICJCNIh8fCIiQgyGIBxCNIiEIAMpA6ACIiMgAykDoAF8IhIgAykDgAN8IhMgAykD4AF8IhZ8IhlCBIZC8P////////8AgyAcQjCIQg+DhEIAQtGHgIAQQgAQRyAAIAMpAwAiJCADKQNgfCIaQv////////8HgzcDACADQfAAaiIBIBtCACAVQgAQRyADQfABaiICIB5CACAYQgAQRyADQdACaiIFICBCACAdQgAQRyADQbABaiIGIBRCACAfQgAQRyADQbACaiIHIBdCACAhQgAQRyADQTBqIgggFiAZVq0gEyAWVq0gDkEIaikDACASIBNWrSARQQhqKQMAIBIgI1StIBBBCGopAwAgD0EIaikDAHx8fHx8fCAiQjSIfHwiI0IMhiAZQjSIhCADKQOwAiImIAMpA7ABfCISIAMpA9ACfCITfCIWQv////////8Hg0IAQpD6gICAAkIAEEcgACAaICRUrSADQQhqKQMAIARBCGopAwB8fCIkQgyGIBpCNIiEIAMpA/ABIicgAykDcHwiGSADKQMwfCIafCIiQv////////8HgzcDCCADQYABaiIEIBdCACAVQgAQRyADQYACaiIJIBtCACAYQgAQRyADQeACaiIKIB5CACAdQgAQRyADQaADaiILICBCACAfQgAQRyADQcABaiIMIBRCACAhQgAQRyADQSBqIg0gAykDoAMiHiADKQPAAXwiFCATIBZWrSASIBNWrSAFQQhqKQMAIBIgJlStIAdBCGopAwAgBkEIaikDAHx8fHwgI0I0iHx8Ih1CDIYgFkI0iIR8Ih9CAEKQ+oCAgAJCABBHIAAgAykDgAIiISADKQOAAXwiFSADKQPgAnwiFyADKQMgfCIYIBogIlatIBkgGlatIAhBCGopAwAgGSAnVK0gAkEIaikDACABQQhqKQMAfHx8fCAkQjSIfHwiIEIMhiAiQjSIhHwiG0L/////////B4M3AxAgA0EQaiIBIBQgH1atIBQgHlStIAtBCGopAwAgDEEIaikDAHx8IB1CNIh8fEIAQoCAxJ6AgMAAQgAQRyAAIBggG1atIBcgGFatIA1BCGopAwAgFSAXVq0gCkEIaikDACAVICFUrSAJQQhqKQMAIARBCGopAwB8fHx8fHwgIEI0iHx8IhdCDIYgG0I0iIQgAykDECIYICVC/////////weDfCIUfCIVQv////////8HgzcDGCAAIBxC////////P4MgFCAVVq0gAUEIaikDACAUIBhUrXwgF0I0iHx8QgyGIBVCNIiEfDcDICADQfADaiQAC/8EAQp+IAFBQGspAwAhCSABQThqKQMAIQcgAUEwaikDACEDIAFByABqKQMAIQUgASkDKCEEIAEpAxggASkDECABKQMIIAEpAwAgASkDICIKQjCIQtGHgIAQfnwiCEI0iHwiAkI0iHwiC0I0iHwhBiACQv////////8HgyAIQv////////8HgyIIIAtC/////////weDIgsgAoMgBoNC/////////wdRIApC////////P4MgBkI0iHwiCkL///////8/UXEgCEKu+P//7///B1ZxrSAKQjCIhELRh4CAEH58IghCNIh8IQIgACAIQv////////8HgyACQjSGhDcAACAFQv///////z+DIAkgByADIAQgBUIwiELRh4CAEH58IgRCNIh8IgNCNIh8IgdCNIh8IglCNIh8IQUgA0L/////////B4MgBEL/////////B4MiBCAHQv////////8HgyIHIAODIAmDQv////////8HUSAFQv///////z9RcSAEQq74///v//8HVnGtIAVCMIiEQtGHgIAQfnwiBEI0iHwhAyAAIARC/////////weDIANCNIaENwAgIAAgAkIMiEL//////x+DIAJCNIggC3wiAkIohoQ3AAggACADQgyIQv//////H4MgA0I0iCAHfCIDQiiGhDcAKCAAIAJCGIhC/////wCDIAZC/////////weDIAJCNIh8IgZCHIaENwAQIAAgA0IYiEL/////AIMgCUL/////////B4MgA0I0iHwiAkIchoQ3ADAgACAGQiSIQv//A4MgBkI0iCAKfEIQhoQ3ABggACACQiSIQv//A4MgAkI0iCAFfEIQhoQ3ADgLtAcCBH8NfiMAQeAAayIEJAACQCABRQRAQcKMKiAAQawBaigCACAAQagBaigCABEAAAwBCyABKAIAIgVBIUHBACADQYACcSIGG0kEQEHtjyogAEGsAWooAgAgAEGoAWooAgARAAAMAQsgAUEANgIAQYSVKiAFEEYhBSACRQRAQeaLKiAAQawBaigCACAAQagBaigCABEAAAwBCyADQf8BcUECRwRAQduKKiAAQawBaigCACAAQagBaigCABEAAAwBCyAEQQA2AlggAikACCIIQgyGQoDg//////8HgyACKQAAIgxCNIiEIQkgAikAECINQhiGQoCAgPj///8HgyAIQiiIhCIRIAIpABgiCEIQiCIKIAxC/////////weDIgwgCYSEhCAIQiSGQoCAgICA/v8HgyANQhyIhCINhFAEQEHEjyogAEGsAWooAgAgAEGoAWooAgARAAAMAQsgAikAMCIIQhyIIQ4gAikAOCIQQiSGQoCAgICA/v8HgyEPIAIpACgiC0IoiCESIAhCGIZCgICA+P///weDIRMgAikAICIIQjSIIRQgC0IMhkKA4P//////B4MhCyAIQv////////8HgyEIAkAgDEKv+P//7///B1QNACAKQv///////z9SDQAgCSARgyANg0L/////////B1INACAMQtGHgIAQfCIKQv////////8HgyEMIAkgCkI0iHwiCkL/////////B4MhCSAKQjSIIBF8IgpC/////////weDIREgCkI0iCANfCIKQv////////8HgyENIApCNIhCAX1C////////P4MhCgsgDiAPhCEOIBIgE4QhDyALIBSEIQsgEEIQiCEQIAQgCjcDKCAEIA03AyAgBCARNwMYIAQgCTcDECAEIAw3AwgCQCAIQq/4///v//8HVA0AIBBC////////P1INACALIA+DIA6DQv////////8HUg0AIAhC0YeAgBB8IglC/////////weDIQggCyAJQjSIfCIJQv////////8HgyELIAlCNIggD3wiCUL/////////B4MhDyAJQjSIIA58IglC/////////weDIQ4gCUI0iEIBfUL///////8/gyEQCyAEIBA3A1AgBCAONwNIIAQgDzcDQCAEIAs3AzggBCAINwMwIAVBAWogBEEIahAnIAECfyAGBEAgBUECQQMgCEIBg1AbOgAAQSEMAQsgBUEEOgAAIAVBIWogBEEwahAnQcEACzYCAEEBIQcLIARB4ABqJAAgBwurAwAgACABKQMgQiiIPAAAIAAgAUEkajUCADwAASAAIAEpAyBCGIg8AAIgACABKQMgQhCIPAADIAAgASkDIEIIiDwABCAAIAEpAyA8AAUgACABKQMYQiyIPAAGIAAgASkDGEIkiDwAByAAIAEpAxhCHIg8AAggACABKQMYQhSIPAAJIAAgASkDGEIMiDwACiAAIAEpAxhCBIg8AAsgACABQRZqMwEAQg+DIAEpAxhCBIaEPAAMIAAgASkDEEIoiDwADSAAIAFBFGo1AgA8AA4gACABKQMQQhiIPAAPIAAgASkDEEIQiDwAECAAIAEpAxBCCIg8ABEgACABKQMQPAASIAAgASkDCEIsiDwAEyAAIAEpAwhCJIg8ABQgACABKQMIQhyIPAAVIAAgASkDCEIUiDwAFiAAIAEpAwhCDIg8ABcgACABKQMIQgSIPAAYIAAgATMBBkIPgyABKQMIQgSGhDwAGSAAIAEpAwBCKIg8ABogACABNQIEPAAbIAAgASkDAEIYiDwAHCAAIAEpAwBCEIg8AB0gACABKQMAQgiIPAAeIAAgASkDADwAHwu/BAEGfiAA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h3wiEUI/hyIPgyAQQv//////////P4N8IhBC//////////8/gyIZNwMAIAIgDyAYgyAOQv//////////P4N8IBBCPod8Ig5C//////////8/gyIQNwMAIABBCGogEDcDACAEIA8gFoMgFEL//////////z+DfCAOQj6HfCIOQv//////////P4MiEDcDACAAQRBqIBA3AwAgBSAPIBWDIBJC//////////8/g3wgDkI+h3wiDkL//////////z+DIhA3AwAgAEEYaiAQNwMAIABBIGogDyATgyARfCAOQj6HfDcDACADIBk3A5gCIANBwAJqJAALvwkCB38KfiMAQaACayIDJAAgA0HgAWogASACEEQgA0HQAWoiASADKQOAAiINQgBCv/2m/rKu6JbAAEIAEEcgA0GwAWoiAiADKQOIAiIOQgBCv/2m/rKu6JbAAEIAEEcgA0HAAWoiBCANQgBCxL/dhZXjyKjFAEIAEEcgA0GQAWoiBSADKQOQAiIQQgBCv/2m/rKu6JbAAEIAEEcgA0GgAWoiBiAOQgBCxL/dhZXjyKjFAEIAEEcgA0HwAGoiByADKQOYAiILQgBCv/2m/rKu6JbAAEIAEEcgA0GAAWoiCCAQQgBCxL/dhZXjyKjFAEIAEEcgA0HgAGoiCSALQgBCxL/dhZXjyKjFAEIAEEcgAykD4AEiDyADKQPQAXwhCiAKIA9UrSADKQPoASISIAFBCGopAwB8fCIMIAMpA7ABfCIRIAMpA8ABfCEPIA8gEVStIAwgEVatIAwgElStIAMpA/ABIhMgAkEIaikDACAEQQhqKQMAfHx8fHwiDCADKQOQAXwiESADKQOgAXwiEiANfCENIA0gElStIBEgElatIAwgEVatIAwgE1StIAMpA/gBIhMgBUEIaikDACAGQQhqKQMAfHx8fHx8IgwgAykDcHwiESADKQOAAXwiEiAOfCEOIANB0ABqIgEgDiASVK0gESASVq0gDCARVq0gDCATVK0gB0EIaikDACADKQNgIhEgCEEIaikDAHx8fHx8fCIMIBB8IhBCAEK//ab+sq7olsAAQgAQRyADQTBqIgIgDCAQVq0gDCARVK0gCyAJQQhqKQMAfHx8IgxCAEK//ab+sq7olsAAQgAQRyADQUBrIgQgEEIAQsS/3YWV48ioxQBCABBHIANBIGoiBSAMQgBC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GkIMhiAdQjSIhHwiIEL/////////B4NCAEKQ+oCAgAJCABBHIAYgBikDMCIfIAYpA4ACfCInIBwgJVatIAtBCGopAwAgEEEIaikDAHx8Ih1CDIYgJUI0iIR8IiVC/////////weDNwOwAyAGQcABaiIQIChCACAmQgAQRyAGQfABaiIRIClCACApQgAQRyAGQSBqIgggJEIAIBlCABBHIAZBEGoiCyAgICNUrSAbICNWrSAKQQhqKQMAIA1BCGopAwB8fCAaQjSIfHwiHkIMhiAgQjSIhCIcIAYpAyB8IhpCAEKQ+oCAgAJCABBHIAYgBikDwAEiGyAGKQPwAXwiIyAGKQMQfCIgICUgJ1StIB8gJ1atIA9BCGopAwAgE0EIaikDAHx8IB1CNIh8fCIZQgyGICVCNIiEfCIdQv////////8HgzcDuAMgBiAaIBxUrSAIQQhqKQMAIB5CNIh8fEIAQoCAxJ6AgMAAQgAQRyAGIAYpAwAiGiAiQv7///////8Hg3wiHCAdICBUrSAgICNUrSALQQhqKQMAIBsgI1atIBBBCGopAwAgEUEIaikDAHx8fHwgGUI0iHx8IhlCDIYgHUI0iIR8IhtC/////////weDNwPAAyAGICFC////////P4MgGyAcVK0gBkEIaikDACAaIBxWrXwgGUI0iHx8QgyGIBtCNIiEfDcDyAMgBkGoBWoiCyAGQagDaiIJIA5B0ABqIggQJCABIAcgCRAkIAFBKGogB0EoaiALECQgASAHKAJ4Igs2AlAgCUEIaiISIAFBCGopAwA3AwAgCUEQaiIUIAFBEGopAwA3AwAgCUEYaiITIAFBGGopAwA3AwAgCUEgaiIKIAFBIGopAwA3AwAgCUEwaiINIAFBMGopAwA3AwAgCUE4aiIPIAFBOGopAwA3AwAgCUFAayIQIAFBQGspAwA3AwAgCUHIAGoiESABQcgAaikDADcDACAGIAs2AqAEIAYgASkDADcDqAMgBiABKQMoNwPQAyAJQfAAaiAHQfAAaikDADcDACAJQegAaiAHQegAaikDADcDACAJQeAAaiAHQeAAaikDADcDACAJQdgAaiAHQdgAaikDADcDACAHKQNQIRkgAiAGKQP4BDcDACACQQhqIA5B2ABqKQMANwMAIAJBEGogDkHgAGopAwA3AwAgAkEYaiAOQegAaikDADcDACACQSBqIA5B8ABqKQMANwMAIAYgGTcD+AMgCSAJIAwgAkEoahBDIAFBqAFqQQA2AgAgASAGKQOoAzcDWCABQeAAaiASKQMANwMAIAFB6ABqIBQpAwA3AwAgAUHwAGogEykDADcDACABQfgAaiAKKQMANwMAIAFBgAFqIAYpA9ADNwMAIAFBiAFqIA0pAwA3AwAgAUGQAWogDykDADcDACABQZgBaiAQKQMANwMAIAFBoAFqIBEpAwA3AwAgCSAJIAwgAkHQAGoQQyABQYACakEANgIAIAEgBikDqAM3A7ABIAFBuAFqIBIpAwA3AwAgAUHAAWogFCkDADcDACABQcgBaiATKQMANwMAIAFB0AFqIAopAwA3AwAgAUHYAWogBikD0AM3AwAgAUHgAWogDSkDADcDACABQegBaiAPKQMANwMAIAFB8AFqIBApAwA3AwAgAUH4AWogESkDADcDACAJIAkgDCACQfgAahBDIAFB2AJqQQA2AgAgASAGKQOoAzcDiAIgAUGQAmogEikDADcDACABQZgCaiAUKQMANwMAIAFBoAJqIBMpAwA3AwAgAUGoAmogCikDADcDACABQbACaiAGKQPQAzcDACABQbgCaiANKQMANwMAIAFBwAJqIA8pAwA3AwAgAUHIAmogECkDADcDACABQdACaiARKQMANwMAIAkgCSAMIAJBoAFqEEMgAUGwA2pBADYCACABIAYpA6gDNwPgAiABQegCaiASKQMANwMAIAFB8AJqIBQpAwA3AwAgAUH4AmogEykDADcDACABQYADaiAKKQMANwMAIAFBiANqIAYpA9ADNwMAIAFBkANqIA0pAwA3AwAgAUGYA2ogDykDADcDACABQaADaiAQKQMANwMAIAFBqANqIBEpAwA3AwAgCSAJIAwgAkHIAWoQQyABQYgEakEANgIAIAEgBikDqAM3A7gDIAFBwANqIBIpAwA3AwAgAUHIA2ogFCkDADcDACABQdADaiATKQMANwMAIAFB2ANqIAopAwA3AwAgAUHgA2ogBikD0AM3AwAgAUHoA2ogDSkDADcDACABQfADaiAPKQMANwMAIAFB+ANqIBApAwA3AwAgAUGABGogESkDADcDACAJIAkgDCACQfABaiIYEEMgAUHgBGpBADYCACABIAYpA6gDNwOQBCABQZgEaiASKQMANwMAIAFBoARqIBQpAwA3AwAgAUGoBGogEykDADcDACABQbAEaiAKKQMANwMAIAFBuARqIAYpA9ADNwMAIAFBwARqIA0pAwA3AwAgAUHIBGogDykDADcDACABQdAEaiAQKQMANwMAIAFB2ARqIBEpAwA3AwAgCSAJIAwgAkGYAmoiDhBDIAFBuAVqQQA2AgAgASAGKQOoAzcD6AQgAUHwBGogEikDADcDACABQfgEaiAUKQMANwMAIAFBgAVqIBMpAwA3AwAgAUGIBWogCikDADcDACABQZAFaiAGKQPQAzcDACABQZgFaiANKQMANwMAIAFBoAVqIA8pAwA3AwAgAUGoBWogECkDADcDACABQbAFaiARKQMANwMAIBUgCUHQAGogCBAkIAZB0AVqJAAjAEGgB2siBSQAIAFB6ARqIghByABqIgspAwAhGiAIIAgpAyggGkIwiELRh4CAEH58IhlC/////////weDNwMoIAhBMGoiBykDACAZQjSIfCEZIAcgGUL/////////B4M3AwAgCEE4aiIHKQMAIBlCNIh8IRkgByAZQv////////8HgzcDACAIQUBrIgcpAwAgGUI0iHwhGSAHIBlC/////////weDNwMAIAsgGkL///////8/gyAZQjSIfDcDACAFQagGaiISQQhqIA4iB0EIaikDADcDACASQRBqIAdBEGopAwA3AwAgEkEYaiAHQRhqKQMANwMAIBJBIGogB0EgaikDADcDACAFIAcpAwA3A6gGQQYhFSAFQagFaiIOQQhqIAFBkARqIgxBCGopAwA3AwAgDkEQaiAMQRBqKQMANwMAIA5BGGogDEEYaikDADcDACAOQSBqIAxBIGopAwA3AwAgDkEwaiAMQTBqKQMANwMAIA5BOGogDEE4aikDADcDACAOQUBrIAxBQGspAwA3AwAgDkHIAGogDEHIAGopAwA3AwAgBSAMKQMANwOoBSAFIAwpAyg3A9AFIAUpA8gGIRogBSkDuAYhISAFKQOwBiEiIAUpA8AGISQgBSkDqAYhGyAFQQA2AqAGIAVB+ARqIhQgJEIAIBtCAYYiI0IAEEcgBUGoBGoiEyAhQgAgIkIBhiIZQgAQRyAFQbgDaiIIIBpCACAaQgAQRyAFQagDaiILIAUpA7gDQgBCkPqAgIACQgAQRyAFQfgDaiIKIBpCAYYiJ0IAIBtC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IgFBGGpCADcDACAEQgA3A9AcIARCADcDsBwgBCADKQMANwPAHCAEIAMpAwg3A8gcIAQgAykDEDcDoBwgBCADKQMYNwOoHCAEQZAYaiAHQQQQQCEPIARBgBRqIAFBBBBAIhAgDyACIAIgD0gbIgEgASAQSBshAgsgAEEBNgJ4IABB+AAQRiEKAkAgAkUNAAJAIAlFBEAgAkECdEEEayIAIARBkBhqaiEJIARBgBRqIABqIQMDQAJAIAooAngEQCAKQQE2AnggCkH4ABBGGgwBCyAKIAoQOQsCQCACIA9KDQAgCSgCACIBRQ0AIARBiB1qIgBBsIQoIAEQQSAKIAogACAEQeAcahBCCwJAIAIgEEoNACADKAIAIgFFDQAgBEGIHWoiAEGwhiggARBBIAogCiAAIARB4BxqEEILIAlBBGshCSADQQRrIQMgAkEBayICQQBKDQALDAELIARBsB1qIQ0gAkECdCIAIARqQfAHaiEJIABBBGsiACAEQZAYamohAyAEQYAUaiAAaiEAIAQoAvwLIQggBCgC+AshCwNAAkAgCigCeARAIApBATYCeCAKQfgAEEYaDAELIAogChA5CwJAIAIgC0oNACAJQYQEaygCACIBRQ0AAkAgAUEATARAIARBiB1qIARBgAxqIAFBf3NBAXZB2ABsakHYABBIGiAEQrzh//+///8fIAQpA7AdfTcDsB0gBEL8////////HyAEKQO4HX03A7gdIARC/P///////x8gBCkDwB19NwPAHSAEQvz///////8fIAQpA8gdfTcDyB0gBEL8////////ASAEKQPQHX03A9AdDAELIARBiB1qIARBgAxqIAFBAWtBAXZB2ABsakHYABBIGgsgCiAKIARBiB1qQQAQQwsCQCACIAhKDQAgCSgCACIBRQ0AIARBADYC2B0CQCABQQBMBEAgDSAEQYAMaiABQX9zQQF2IgFB2ABsaiIHKQMoNwMAIA1BCGogB0EwaikDADcDACANQRBqIAdBOGopAwA3AwAgDUEYaiAHQUBrKQMANwMAIA1BIGogB0HIAGopAwA3AwAgBEGIHWoiB0EgaiAEQcARaiABQShsaiIBQSBqKQMANwMAIAdBGGogAUEYaikDADcDACAHQRBqIAFBEGopAwA3AwAgB0EIaiABQQhqKQMANwMAIAQgASkDADcDiB0gBEK84f//v///HyAEKQOwHX03A7AdIARC/P///////x8gBCkDuB19NwO4HSAEQvz///////8fIAQpA8AdfTcDwB0gBEL8////////HyAEKQPIHX03A8gdIARC/P///////wEgBCkD0B19NwPQHQwBCyANIARBgAxqIAFBAWtBAXYiAUHYAGxqIhEpAyg3AwAgBEGIHWoiB0EgaiAEQcARaiABQShsaiIBQSBqKQMANwMAIAdBGGogAUEYaikDADcDACAHQRBqIAFBEGopAwA3AwAgB0EIaiABQQhqKQMANwMAIA1BCGogEUEwaikDADcDACANQRBqIBFBOGopAwA3AwAgDUEYaiARQUBrKQMANwMAIA1BIGogEUHIAGopAwA3AwAgBCABKQMANwOIHQsgCiAKIARBiB1qQQAQQwsCQCACIA9KDQAgAygCACIHRQ0AIARBiB1qIgFBsIQoIAcQQSAKIAogASAEQeAcahBCCwJAIAIgEEoNACAAKAIAIgdFDQAgBEGIHWoiAUGwhiggBxBBIAogCiABIARB4BxqEEILIAlBBGshCSADQQRrIQMgAEEEayEAIAJBAWsiAkEASg0ACwsgCigCeA0AIApB0ABqIgAgACAEQeAcahAkCyAEQeAdaiQAC6ADAgJ/B34jAEEwayICJAAgAkEIaiIDIAFB0ABqEDggAyADIAAQJCABKQMYIAEpAxAgASkDCCABKQMAIAEpAyAiBUIwiELRh4CAEH58IgZCNIh8IgdCNIh8IghCNIh8IQQgBkL/////////B4MgAikDCH0gBUL///////8/gyACKQMofSAEQjSIfEL8////////AXwiCUIwiELRh4CAEH58Qrzh//+///8ffCIFQv////////8HgyIKQtCHgIAQhSEGAn8gCkIAUgRAQQAgBkL/////////B1INARoLIAlC////////P4MgBEL/////////B4MgAikDIH0gCEL/////////B4MgAikDGH0gB0L/////////B4MgBUI0iHwgAikDEH1C/P///////x98IgRCNIh8Qvz///////8ffCIHQjSIfEL8////////H3wiCEI0iHwiCSAEIAWEIAeEIAiEQv////////8Hg4RQBH9BAQUgBiAJQoCAgICAgMAHhYMgBIMgB4MgCINC/////////wdRCwshASACQTBqJAAgAQvvBAIBfwR+IwBB4AFrIgYkACAGQQhqIAFBABAoIAZB8ABqIgFBEGogAkEQaikAADcDACABQRhqIAJBGGopAAA3AwAgBiACKQAANwNwIAYgAkEIaikAADcDeCAGIAYpAwgiBzwArwEgBiAGKQMQIgg8AKcBIAYgBikDGCIJPACfASAGIAYpAyAiCjwAlwEgBiAHQgiIPACuASAGIAdCEIg8AK0BIAYgB0IYiDwArAEgBiAHQiCIPACrASAGIAdCKIg8AKoBIAYgB0IwiDwAqQEgBiAHQjiIPACoASAGIAhCCIg8AKYBIAYgCEIQiDwApQEgBiAIQhiIPACkASAGIAhCIIg8AKMBIAYgCEIoiDwAogEgBiAIQjCIPAChASAGIAhCOIg8AKABIAYgCUIIiDwAngEgBiAJQhCIPACdASAGIAlCGIg8AJwBIAYgCUIgiDwAmwEgBiAJQiiIPACaASAGIAlCMIg8AJkBIAYgCUI4iDwAmAEgBiAKQgiIPACWASAGIApCEIg8AJUBIAYgCkIYiDwAlAEgBiAKQiCIPACTASAGIApCKIg8AJIBIAYgCkIwiDwAkQEgBiAKQjiIPACQASAEBH8gBkHIAWogBEEYaikAADcDACAGQcABaiAEQRBqKQAANwMAIAZBuAFqIARBCGopAAA3AwAgBiAEKQAANwOwAUHgAAVBwAALIQIgBkEoaiAGQfAAaiADBH8gBkHwAGogAmoiASADKQAANwAAIAFBCGogA0EIaikAADcAACACQRByBSACCxAvQQAhAgNAIAZBKGogABAwIAUgAkEBaiICTw0ACyAGQeABaiQAQQEL6BABB38jAEGQAmsiAyQAIABCgYKEiJCgwIABNwIAIABCADcCICAAQRhqQoGChIiQoMCAATcCACAAQRBqQoGChIiQoMCAATcCACAAQQhqQoGChIiQoMCAATcCACAAQShqQgA3AgAgAEEwakIANwIAIABBOGpCADcCACADQYABakKrs4/8kaOz8NsANwMAIANB+ABqQv+kuYjFkdqCm383AwAgA0HwAGpC8ua746On/aelfzcDACADQcgBakIANwMAIANB0AFqIgVBOGpCADcDACAFQTBqQgA3AwAgBUEoakIANwMAIAVBIGpCADcDACAFQRhqQgA3AwAgBUEQakIANwMAIANC58yn0NbQ67O7fzcD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AkEIakIANwMAIAJCADcDACADBEAgA0EANgIACyAGQeAAakHklCogBkGAAmoQKEIAQn8gBigCgAIgBikDeCIRIAYpA3AiECAGKQNoIgwgBikDYCINhISEUHIiCBshCyAGIAsgEYM3A3ggBiALIBCDNwNwIAYgCyAMgzcDaCAGIAhBAEetIAsgDYOENwNgIAZBIGpBoYIoQQAQKCAIRSEJAkAgBkGhgihB5JQqQQAgBUEAIARBBCAEGyIKEQgARQ0AQQEhBANAIAQhCCAGQUBrIgcgBiAGQYACaiIEECgCQCAGKAKAAiAGKQNYIhQgBikDUCISIAYpA0giECAGKQNAIhGEhIRQcg0AIAZBADYChAEgACAEIAcQMiAGQagBaiAEEDMgBiAGKQPAASAGKQO4ASAGKQOwASAGKQOoASAGKQPIASILQjCIQtGHgIAQfnwiD0I0iHwiDEI0iHwiDkI0iHwiDSAOQv////////8HgyITIAyDg0L/////////B1EgC0L///////8/gyANQjSIfCIOQv///////z9RcSAPQv////////8HgyILQq74///v//8HVnGtIA5CMIiEQtGHgIAQfiALfCILPACfAyAGIAtCCIg8AJ4DIAYgC0IQiDwAnQMgBiALQhiIPACcAyAGIAtCIIg8AJsDIAYgC0IoiDwAmgMgBiAMQv////////8HgyALQjSIfCIMQgSIPACYAyAGIAxCDIg8AJcDIAYgDEIUiDwAlgMgBiAMQhyIPACVAyAGIAxCJIg8AJQDIAYgDEIsiDwAkwMgBiALQjCIQg+DIAxCBIaEPACZAyAGIAxCNIggE3wiCzwAkgMgBiALQgiIPACRAyAGIAtCEIg8AJADIAYgC0IYiDwAjwMgBiALQiCIPACOAyAGIAtCKIg8AI0DIAYgDUL/////////B4MgC0I0iHwiDEIEiDwAiwMgBiAMQgyIPACKAyAGIAxCFIg8AIkDIAYgDEIciDwAiAMgBiAMQiSIPACHAyAGIAxCLIg8AIYDIAYgC0IwiEIPgyAMQgSGhDwAjAMgBiAMQjSIIA58Igs8AIUDIAYgC0IIiDwAhAMgBiALQhCIPACDAyAGIAtCGIg8AIIDIAYgC0IgiDwAgQMgBiALQiiIPACAAyAGKQPwASELIAYpA+gBIQwgBikD4AEhDSAGKQPYASEOIAYpA9ABIQ8gASAGQYADaiAGQYQBahAoIAMEQCALQv///////z+DIA0gC0IwiELRh4CAEH4gD3wiC0I0iCAOfCIOQjSIfCINQjSIIAx8Ig9CNIh8IQwgAyANIA6DIA+DQv////////8Hg0L/////////B1EgDEL///////8/UXEgC0L/////////B4NCrvj//+///wdWca0gDEIwiIQgC3ynQQFxIAYoAoQBQQF0cjYCAAsgBkGIAWoiByABIAZB4ABqECsgBikDICILIAYpA4gBfCENIAsgDVatIg8gBikDkAF8IgwgBikDKHwhCyAGKQMwIhMgBikDmAF8Ig4gDCAPVK0gCyAMVK18fCEMIAYpAzgiFSAGKQOgAXwiDyAOIBNUrSAMIA5UrXx8Ig5Cf1IgDEJ+VHIhBCAGIA0gDyAVVCAOIA9UaiANQsCC2YHN0Zfpv39WIAtCu8Ci+uqct9e6f1ZyIAtCu8Ci+uqct9e6f1QgBHJBf3NxIARBf3MgDEJ/UXFyaq0iDUK//ab+sq7olsAAfiITfCIVNwOIASAGIAsgDULEv92FlePIqMUAfnwiDyATIBVWrXwiEzcDkAEgBiAMIA18Ig0gCyAPVq0gDyATVq18fCILNwOYASAGIAwgDVatIAsgDVStfCAOfDcDoAEgBiAUQjiINwPIAyAGIBRCBoYgEkI6iIRC//////////8/gzcDwAMgBiASQgSGIBBCPIiEQv//////////P4M3A7gDIAYgEEIChiARQj6IhEL//////////z+DNwOwAyAGIBFC//////////8/gzcDqAMgBkGoA2pBkJEqEDQgAiAGKQPIA0I4hiAGKQPAAyILQgaIhDcDGCACIAtCOoYgBikDuAMiC0IEiIQ3AxAgAiALQjyGIAYpA7ADIgtCAoiENwMIIAIgBikDqAMgC0I+hoQ3AwAgAiACIAcQK0LCgtmBzdGX6b9/QgAgAikDCCILQp2gkb21ztur3QBWIAIpAwAiEEKgwezA5ujL9F9WciACKQMQIhFCf1IgC0KdoJG9tc7bq90AVHIgAikDGCIMQj+IpyIEQX9zcSAMQv///////////wBUckF/c3EgBHIiBBshEiACIBJCf0IAIAQbIg0gEIV8IhRCf0IAIAwgEYQgC4QgEIRCAFIbIhCDIg43AwAgAkK7wKL66py317p/QgAgBBsiDyALIA2FfCILIBIgFFatfCISIBCDIhQ3AwggAkJ+QgAgBBsiEyANIBGFfCIRIAsgD1StIAsgElatfHwiCyAQgyISNwMQIAIgESATVK0gCyARVK18IAwgDYUgBK19fCAQgyILNwMYIAMEQCADIAMoAgAgBHM2AgALIA4gFIQgEoQgC4RQDQAgASkDGCABKQMQIAEpAwggASkDAISEhFANAEEBIQcMAgsgCEEBaiEEQQAhByAGQaGCKEHklCpBACAFIAggChEIAA0ACwsgASAHIAlxIgBFIgStQgF9IgsgASkDAIM3AwAgASABKQMIIAuDNwMIIAEgASkDECALgzcDECABIAEpAxggC4M3AxggAiACKQMAIAuDNwMAIAIgAikDCCALgzcDCCACIAIpAxAgC4M3AxAgAiACKQMYIAuDNwMYIAMEQCAGIAQ2AoACIAMgAygCACAGKAKAAkEBa3E2AgALIAZB0ANqJAAgAAuuCAIHfwh+IwBBgAFrIgMkACABIABBKGpBgAEQSCEJIAApAwgiCyACKQMAfCEMIAsgDFatIgogAikDCHwiDSAAQRBqKQMAfCELIAogDVatIAsgDVStfCIPIAIpAxB8IgogAEEYaikDAHwhDSAKIA9UrSAKIA1WrXwiDiACKQMYfCIKIABBIGopAwB8Ig9Cf1IgDUJ+VHIhACADIAwgCiAOVCAKIA9WaiAMQsCC2YHN0Zfpv39WIAtCu8Ci+uqct9e6f1ZyIAtCu8Ci+uqct9e6f1QgAHJBf3NxIABBf3MgDUJ/UXFyaq0iDEK//ab+sq7olsAAfiIKfCIONwMIIAMgCiAOVq0gCyAMQsS/3YWV48ioxQB+fCIKfCIONwMQIAMgCiALVK0gCiAOVq18IAwgDXwiC3wiDDcDGCADIAsgDVStIAsgDFatfCAPfDcDIEIAIQtCACENQgAhDEIAIQpCACEPQgAhDgNAIANBADYCeCADQQhqIAhBAnZB+P///wNxaikDACAGQT5xrYinQQNxIgFBAUYhAiADIAdBsIgoaiIAQfgBaikDACAAQbgBaikDACAAQfgAaikDACALIABBOGopAwAgARsgAhsgAUECRiIEGyABQQNGIgUbIgtCEIg3A3AgAyAAQeABaikDACAAQaABaikDACAAQeAAaikDACAKIABBIGopAwAgARsgAhsgBBsgBRsiCkL/////////B4M3A1AgAyAAQdgBaikDACAAQZgBaikDACAAQdgAaikDACAPIABBGGopAwAgARsgAhsgBBsgBRsiD0IQiDcDSCADIABBwAFqKQMAIABBgAFqKQMAIABBQGspAwAgESAAKQMAIAEbIAIbIAQbIAUbIhFC/////////weDNwMoIAMgC0IkhkKAgICAgP7/B4MgAEHwAWopAwAgAEGwAWopAwAgAEHwAGopAwAgDSAAQTBqKQMAIAEbIAIbIAQbIAUbIg1CHIiENwNoIAMgDUIYhkKAgID4////B4MgAEHoAWopAwAgAEGoAWopAwAgAEHoAGopAwAgDCAAQShqKQMAIAEbIAIbIAQbIAUbIgxCKIiENwNgIAMgDEIMhkKA4P//////B4MgCkI0iIQ3A1ggAyAPQiSGQoCAgICA/v8HgyAAQdABaikDACAAQZABaikDACAAQdAAaikDACAOIABBEGopAwAgARsgAhsgBBsgBRsiDkIciIQ3A0AgAyAOQhiGQoCAgPj///8HgyAAQcgBaikDACAAQYgBaikDACAAQcgAaikDACAQIABBCGopAwAgARsgAhsgBBsgBRsiEEIoiIQ3AzggAyAQQgyGQoDg//////8HgyARQjSIhDcDMCAJIAkgA0EoahA3IAZBAmohBiAIQQFqIQggB0GAAmoiB0GAgAJHDQALIANBgAFqJAALmQYCB38FfiMAQdAAayICJAAgACABKAJ4NgJQIAFB6ABqIgQpAwAgAUHgAGoiBSkDACABQdgAaiIGKQMAIAEpA1AgAUHwAGoiBykDACIMQjCIQtGHgIAQfnwiCkI0iHwiCUI0iHwiDUI0iHwhCyACIAlC/////////weDIApC/////////weDIgogDUL/////////B4MiDSAJgyALg0L/////////B1EgDEL///////8/gyALQjSIfCIJQv///////z9RcSAKQq74///v//8HVnGtIAlCMIiEQtGHgIAQfnwiCkI0iHwiDEI0hkKAgICAgICA+D+DIApC/////////weDhDcDKCACIAxCNIggDXwiCkIqhkKAgICAgID//z+DIAxCCohC////////AIOENwMwIAIgC0L/////////B4MgCkI0iHwiC0IghkKAgICA8P///z+DIApCFIhC/////w+DhDcDOCACIAtCNIggCXwiCUIoiEL/AYM3A0ggAiAJQhaGQoCAgP7/////P4MgC0IeiEL///8Bg4Q3A0AgAkEoaiIDQaCSKhA0IAEgAikDKCILQv////////8HgzcDUCAHIAIpA0hCKIYgAikDQCIJQhaIhDcDACAEIAlCHoZCgICAgPz//weDIAIpAzgiCUIgiIQ3AwAgBSAJQhSGQoCAwP////8HgyACKQMwIglCKoiENwMAIAYgCUIKhkKA+P//////B4MgC0I0iIQ3AwAgAyABQdAAaiIIEDggAiAIIAMQJCABIAEgAxAkIAFBKGoiAyADIAIQJCAHQgA3AwAgBEIANwMAIAVCADcDACAGQgA3AwAgAUIBNwNQIAAgASkDADcDACAAQQhqIAFBCGopAwA3AwAgAEEQaiABQRBqKQMANwMAIABBGGogAUEYaikDADcDACAAQSBqIAFBIGopAwA3AwAgACABKQMoNwMoIABBMGogAUEwaikDADcDACAAQThqIAFBOGopAwA3AwAgAEFAayABQUBrKQMANwMAIABByABqIAFByABqKQMANwMAIAJB0ABqJAALxQ8CFn8ZfiMAQbADayICJAAgAkGIA2oiA0EgakIANwMAIANBGGpCADcDACADQRBqQgA3AwAgA0EIakIANwMAIAJCADcDiAMgAkHgAmoiA0EgakIANwMAIANBGGpCADcDACADQRBqQgA3AwAgAkIANwPoAiACQgE3A+ACIAApAyAhICAAKQMYISEgACkDECEiIAApAwghJSAAKQMAIRhCfyEqIAEpAwAiLCEaIAEpAwgiLSEnIAEpAxAiLiEoIAEpAxgiLyEpIAEpAyAiMCEmA0BCCCEbQTshA0IAIRwgGCEZIBohHUIAIR5CCCEfA0AgGUIAIBlCAYN9IiMgKkI/hyIZIB2FIBl9g3wiKyAZICODIiSDIB18IR0gJCAfIBkgHIUgGX0gI4N8Ih+DIBx8QgGGIRwgJCAZIBuFIBl9ICODIB58Ih6DIBt8QgGGIRsgJCAqhUIBfSEqICtCAYghGSADQQFrIgMNAAsgAiAfNwPYAiACIB43A9ACIAIgHDcDyAIgAiAbNwPAAiACQYgDaiIDIAJB4AJqIAJBwAJqIAEQRSACQbACaiIFIBsgG0I/hyIZIBogGkI/hyIkEEcgAkGQAmoiBiAcIBxCP4ciHSAYIBhCP4ciKxBHIAJBoAJqIgcgHiAeQj+HIiMgGiAkEEcgAkGAAmoiCCAfIB9CP4ciGiAYICsQRyACQfABaiIJIBsgGSAnICdCP4ciGBBHIAJB0AFqIgogHCAdICUgJUI/hyIkEEcgAkHgAWoiCyAeICMgJyAYEEcgAkHAAWoiDCAfIBogJSAkEEcgAkGwAWoiDSAbIBkgKCAoQj+HIhgQRyACQZABaiIOIBwgHSAiICJCP4ciJRBHIAJBoAFqIg8gHiAjICggGBBHIAJBgAFqIhAgHyAaICIgJRBHIAJB8ABqIhEgGyAZICkgKUI/hyIYEEcgAkHQAGoiEiAcIB0gISAhQj+HIiIQRyACQeAAaiITIB4gIyApIBgQRyACQUBrIhQgHyAaICEgIhBHIAJBMGoiFSAbIBkgJiAmQj+HIhgQRyACQRBqIhYgHCAdICAgIEI/hyIZEEcgAkEgaiIXIB4gIyAmIBgQRyACIB8gGiAgIBkQRyACKQOQAiIaIAIpA7ACfCEYIBggGlStIAZBCGopAwAgBUEIaikDAHx8IhlCAoYgGEI+iIQgAikD0AEiHSACKQPwAXwiGHwhGiAYIBpWrSAYIB1UrSAKQQhqKQMAIAlBCGopAwB8fCAZQj6HfHwiHUIChiAaQj6IhCACKQOQASIbIAIpA7ABfCIZfCEYIBggGVStIBkgG1StIA5BCGopAwAgDUEIaikDAHx8IB1CPod8fCIbQgKGIBhCPoiEIAIpA1AiHCACKQNwfCIdfCEZIBkgHVStIBwgHVatIBJBCGopAwAgEUEIaikDAHx8IBtCPod8fCIcQgKGIBlCPoiEIAIpAxAiHiACKQMwfCIbfCEdIBsgHVatIBsgHlStIBZBCGopAwAgFUEIaikDAHx8IBxCPod8fEIChiAdQj6IhCEmIAIpA4ACIhwgAikDoAJ8IRsgGyAcVK0gCEEIaikDACAHQQhqKQMAfHwiHkIChiAbQj6IhCACKQPAASIfIAIpA+ABfCIcfCEbIBsgHFStIBwgH1StIAxBCGopAwAgC0EIaikDAHx8IB5CPod8fCIfQgKGIBtCPoiEIAIpA4ABIiAgAikDoAF8Ih58IRwgHCAeVK0gHiAgVK0gEEEIaikDACAPQQhqKQMAfHwgH0I+h3x8IiBCAoYgHEI+iIQgAikDQCIhIAIpA2B8Ih98IR4gHiAfVK0gHyAhVK0gFEEIaikDACATQQhqKQMAfHwgIEI+h3x8IiFCAoYgHkI+iIQgAikDACIiIAIpAyB8IiB8IR8gHyAgVK0gICAiVK0gAkEIaikDACAXQQhqKQMAfHwgIUI+h3x8QgKGIB9CPoiEISAgH0L//////////z+DISEgHUL//////////z+DISkgHkL//////////z+DISIgGUL//////////z+DISggHEL//////////z+DISUgGEL//////////z+DIScgG0L//////////z+DIRggGkL//////////z+DIRogBEEBaiIEQQpHDQALICZCP4ciGCACKQOIAyADQSBqIgEpAwAiHUI/hyIaICyDfIUgGH0hGSAAIBogMIMgHXwgGIUgGH0gA0EYaiIEKQMAIBogL4N8IBiFIBh9IANBEGoiBSkDACAaIC6DfCAYhSAYfSADQQhqKQMAIBogLYN8IBiFIBh9IBlCPod8IhpCPod8Ih1CPod8IhtCPod8IhxCP4ciGCAsgyAZQv//////////P4N8IhlC//////////8/gzcDACAAQQhqIBggLYMgGkL//////////z+DfCAZQj6HfCIaQv//////////P4M3AwAgBSAYIC6DIB1C//////////8/g3wgGkI+h3wiGkL//////////z+DIhk3AwAgAEEQaiAZNwMAIAQgGCAvgyAbQv//////////P4N8IBpCPod8IhpC//////////8/gyIZNwMAIABBGGogGTcDACABIBggMIMgHHwgGkI+h3wiGDcDACAAQSBqIBg3AwAgAkGwA2okAAuxAgICfwZ+IwBBMGsiAiQAAn8gAUUEQEGjiyogAEGsAWooAgAgAEGoAWooAgARAABBAAwBCyACQQhqIgAgASACQSxqEChCAEJ/IAIoAiwgAikDICIEIAIpAxgiCCACKQMQIgYgAikDCCIHhISEUHIiAxshBSACQn9CACAFIAeDIgcgBCAFgyIJIAUgBoMiBCAFIAiDIgiEhIRCAFIbIgUgB0J/hSIGQr79pv6yruiWwAB9IgeDNwMIIAIgBiAHVq0gBEJ/hSIGfCIEQsW/3YWV48ioxQB9IgcgBYM3AxAgAiAIQn+FIgggBCAGVK0gBCAHVq18fCIEQgJ9IgYgBYM3AxggAiAEIAhUrSAEIAZWrXwgCX1CAn0gBYM3AyAgASAAECkgA0ULIQEgAkEwaiQAIAELxwMCDH4DfyMAQdAAayIAJAAgAEEIaiIOQeSUKiAAQTBqIg0QKCAAKAIwIQ8gACkDICEIIAApAxghCSAAKQMIIQogACkDECELIABBADYCLCANQYWWKiAAQSxqECggACkDMCIBIAp8IQQgACkDOCICIAt8IgMgASAEVq18IQEgACkDQCIGIAl8IgUgAiADVq0gASADVK18fCEDIAApA0giByAIfCICIAUgBlStIAMgBVStfHwiBkJ/UiADQn5UciENIAIgB1QgAiAGVmogBELAgtmBzdGX6b9/ViABQrvAovrqnLfXun9WciABQrvAovrqnLfXun9UIA1yQX9zcSANQX9zIANCf1FxcmqtIgIgA3whBSACQr/9pv6yruiWwAB+IgwgBHwhBCABIAJCxL/dhZXjyKjFAH58IgcgBCAMVK18IQIgACADIAVWrSAFIAEgB1atIAIgB1StfHwiAyAFVK18IAZ8IgFCACAAKAIsIA8gCCAJIAogC4SEhFByckUgASACIASEIAOEhEIAUnEiDa19IgGDNwMgIAAgASADgzcDGCAAIAEgAoM3AxAgACABIASDNwMIQeSUKiAOECkgAEHQAGokACANC7w3Aht/LX4jAEHQDWsiAyQAIANBqA1qIg4gAUHQAGoiExA4IANBgA1qIgZBCGoiDyABQQhqKQMAIAEpAwAgAUEgaikDACIeQjCIQtGHgIAQfnwiIEI0iHwiIUL/////////B4MiLzcDACAGQRBqIhcgAUEQaikDACAhQjSIfCIhQv////////8HgyItNwMAIAZBGGoiESABQRhqKQMAICFCNIh8IiFC/////////weDIi43AwAgBkEgaiISIB5C////////P4MgIUI0iHwiMDcDACADICBC/////////weDIjE3A4ANIANB2AxqIAIgDhAkIAFBQGspAwAhOCABQThqKQMAITkgAUEwaikDACE6IAFByABqKQMAITIgASkDKCE1IANBsAxqIhAgAkEoaiAOECQgECAQIBMQJCADQYgMaiIOQSBqIhAgEikDACIhNwMAIA5BGGoiEiARKQMAIh43AwAgDkEQaiIRIBcpAwAiIDcDACAOQQhqIhcgDykDACIfNwMAIAMgAykDgA0iKTcDiAwgA0HwCGoiDyADKQPwDCInIB58Ih5CACADKQPYDCIrICl8IipCAYYiIkIAEEcgA0GwCWoiBCADKQPoDCIzICB8IiBCACADKQPgDCI2IB98IilCAYYiJkIAEEcgA0GwCmoiBSADKQP4DCI3ICF8IihCACAoQgAQRyADQaAKaiIHIAMpA7AKQgBCkPqAgIACQgAQRyADQcAIaiIIIChCAYYiH0IAICpCABBHIANBoAlqIgkgHkIAICZCABBHIANB4AlqIgogIEIAICBCABBHIANBkApqIgwgBUEIaikDAEIAQoCAxJ6AgMAAQgAQRyADQfAHaiIFICpCACAqQgAQRyADQZAJaiINIB9CACApQgAQRyADQcAJaiILIB5CACAgQgGGQgAQRyADKQPwCCIlIAMpA7AJfCIhIAMpA6AKfCEmICEgJlatIAdBCGopAwAgISAlVK0gD0EIaikDACAEQQhqKQMAfHx8fCIsQgyGICZCNIiEIAMpA6AJIjQgAykD4Al8IiUgAykDwAh8IiQgAykDkAp8IiN8ISEgA0GACGoiDyAhICNUrSAjICRUrSAMQQhqKQMAICQgJVStIAhBCGopAwAgJSA0VK0gCUEIaikDACAKQQhqKQMAfHx8fHx8ICxCNIh8fCIjQgyGICFCNIiEIAMpA5AJIiwgAykDwAl8IiV8IiRCBIZC8P////////8AgyAhQjCIQg+DhEIAQtGHgIAQQgAQRyADQeAIaiIEIClCACAiQgAQRyADQdAJaiIHIB9CACAgQgAQRyADQYAKaiIIIB5CACAeQgAQRyADQbAIaiIJICQgJVStICUgLFStIA1BCGopAwAgC0EIaikDAHx8ICNCNIh8fCIjQgyGICRCNIiEIAMpA9AJIiwgAykDgAp8IiV8IiRC/////////weDQgBCkPqAgIACQgAQRyADQdAIaiIKICBCACAiQgAQRyADQYAJaiIMIClCACApQgAQRyADQfAJaiINIB9CACAeQgAQRyADQaAIaiILICQgJVStICUgLFStIAdBCGopAwAgCEEIaikDAHx8ICNCNIh8fCIfQgyGICRCNIiEIiIgAykD8Al8IiVCAEKQ+oCAgAJCABBHIANBkAhqIgcgIiAlVq0gDUEIaikDACAfQjSIfHxCAEKAgMSegIDAAEIAEEcgBUEIaikDACEsIA9BCGopAwAhNCADKQPwByEjIAMpA4AIIR8gBEEIaikDACE7IAlBCGopAwAhPCADKQPgCCE9IAMpA7AIISIgDEEIaikDACE+IApBCGopAwAhPyADKQOACSFAIAMpA9AIISUgC0EIaikDACFBIAMpA6AIIUIgAykDkAghJCAHQQhqKQMAIUMgAykDyAwhRCADKQPADCFFIAMpA7AMIUYgAykD0AwhRyADKQO4DCFIIANCvOH//7///x8gK30iSTcD6AogA0L8////////HyA2fSI2NwPwCiADQvz///////8fIDN9IjM3A/gKIANC/P///////x8gJ30iSjcDgAsgA0L8////////ASA3fSI3NwOICyADQeALaiAGIANB6ApqIg8QJCAiID18IicgHyAjfCIjIB9UrSAsIDR8fCIrQgyGICNCNIiEfCEfIB8gJ1StICIgJ1atIDsgPHx8ICtCNIh8fCIsQgyGIB9CNIiEICUgQHwiJyBCfCIrfCEiIDJC////////P4MgOCA5IDogNSAyQjCIQtGHgIAQfnwiNUI0iHwiOkI0iHwiOUI0iHwiOEI0iHwiNCBHfCEyIAMpA/gLICQgJkL+////////B4N8IiYgIiArVK0gJyArVq0gQSAlICdWrSA+ID98fHx8ICxCNIh8fCInQgyGICJCNIiEfCIlQv////////8Hg3wiLCADKQPwCyAiQv////////8Hg3wiOyADKQPoCyAfQv////////8Hg3wiPCADKQPgCyAjQv////////8Hg3wiPSADKQOADCAhQv///////z+DfCAlICZUrSBDICQgJlatfCAnQjSIfHxCDIYgJUI0iIR8Ih9CMIhC0YeAgBB+fCImQjSIfCIiQjSIfCIlQjSIfCEhIB9C////////P4MgIUI0iHwhJCADIDRCAYYgHyAyQv///////z+DIDhC/////////weDIjQgRHwiOCA5Qv////////8HgyI+IEV8IjkgOkL/////////B4MiPyBIfCI6IDVC/////////weDIkAgRnwiNSAyQjCIQtGHgIAQfnwiH0I0iHwiI0I0iHwiJ0I0iHwiK0I0iHwiQSAfICOEICeEICuEQv////////8Hg4RQBH9BAQUgH0LQh4CAEIUgQUKAgICAgIDAB4WDICODICeDICuDQv////////8HUQsgIiAmhCAlhCAhhEL/////////B4MgJIRQBH9BAQUgJkLQh4CAEIUgJEKAgICAgIDAB4WDICKDICWDICGDQv////////8HUQtxIgYbNwPgCiADIDRCAYYgLCAGGzcD2AogAyA+QgGGIDsgBhs3A9AKIAMgP0IBhiA8IAYbNwPICiADIEBCAYYgPSAGGyIlNwPACiADIDAgN3wgMiAGGyIkNwOICyADIC4gSnwgOCAGGyIhNwOACyADIC0gM3wgOSAGGyIfNwP4CiADIC8gNnwgOiAGGyImNwPwCiADIDEgSXwgNSAGGyIiNwPoCiADQfAGaiIEICJCAYYiL0IAICFCABBHIANBoAdqIgUgH0IAICZCAYYiI0IAEEcgA0GwBmoiByAkQgAgJEIAEEcgA0GgBmoiCCADKQOwBkIAQpD6gICAAkIAEEcgA0GABmoiCSAiQgAgJEIBhiInQgAQRyADQeAGaiIKICFCACAjQgAQRyADQZAHaiIMIB9CACAfQgAQRyADQZAGaiINIAdBCGopAwBCAEKAgMSegIDAAEIAEEcgA0HQB2oiByAiQgAgIkIAEEcgA0HwBWoiCyAnQgAgJkIAEEcgA0HQBmoiFCAhQgAgH0IBhkIAEEcgAykDoAYiJCADKQOgB3wiIiADKQPwBnwhKyAiICtWrSAEQQhqKQMAICIgJFStIAhBCGopAwAgBUEIaikDAHx8fHwiLkIMhiArQjSIhCADKQPgBiIwIAMpA5AHfCIiIAMpA4AGfCIjIAMpA5AGfCItfCEkIANB4AVqIgQgJCAtVK0gIyAtVq0gDUEIaikDACAiICNWrSAJQQhqKQMAICIgMFStIApBCGopAwAgDEEIaikDAHx8fHx8fCAuQjSIfHwiMEIMhiAkQjSIhCADKQPwBSIxIAMpA9AGfCIifCItQgSGQvD/////////AIMgJEIwiEIPg4RCAELRh4CAEEIAEEcgAyADKQPgBSIzIAMpA9AHfCIuQv////////8HgyIjNwO4CyADQcAHaiIFIC9CACAmQgAQRyADQcAFaiIIICdCACAfQgAQRyADQcAGaiIJICFCACAhQgAQRyADQbAFaiIKICIgLVatICIgMVStIAtBCGopAwAgFEEIaikDAHx8IDBCNIh8fCI2QgyGIC1CNIiEIAMpA8AFIjcgAykDwAZ8Ii18IjBC/////////weDQgBCkPqAgIACQgAQRyADIC4gM1StIARBCGopAwAgB0EIaikDAHx8IjNCDIYgLkI0iIQgAykDsAUiLCADKQPAB3wiLnwiMUL/////////B4MiIjcDwAsgA0GAB2oiBCAvQgAgH0IAEEcgA0GwB2oiByAmQgAgJkIAEEcgA0GABWoiDCAnQgAgIUIAEEcgA0HwBGoiDSAtIDBWrSAtIDdUrSAIQQhqKQMAIAlBCGopAwB8fCA2QjSIfHwiL0IMhiAwQjSIhCItIAMpA4AFfCIwQgBCkPqAgIACQgAQRyADIC4gMVatICwgLlatIApBCGopAwAgBUEIaikDAHx8IDNCNIh8fCIuQgyGIDFCNIiEIAMpA4AHIjEgAykDsAd8Ih8gAykD8AR8IiZ8IidC/////////weDIiE3A8gLIANBsARqIgUgLSAwVq0gDEEIaikDACAvQjSIfHxCAEKAgMSegIDAAEIAEEcgAyAmICdWrSAfICZWrSANQQhqKQMAIB8gMVStIARBCGopAwAgB0EIaikDAHx8fHwgLkI0iHx8Ii9CDIYgJ0I0iIQgK0L+////////B4MgAykDsAQiK3wiJnwiJ0L/////////B4MiHzcD0AsgAyAkQv///////z+DICYgJ1atIAVBCGopAwAgJiArVK18IC9CNIh8fEIMhiAnQjSIhHwiJjcD2AsgA0L6////////AiAofTcDsAsgA0L6////////LyAefTcDqAsgA0L6////////LyAgfTcDoAsgA0L6////////LyApfTcDmAsgA0Ka0v//n///LyAqfTcDkAsgA0GgBGoiBCAfQgAgI0IBhiIgQgAQRyADQeAEaiIFICFCACAiQgGGIilCABBHIANB4ANqIgcgJkIAICZCABBHIANB0ANqIgggAykD4ANCAEKQ+oCAgAJCABBHIANBsANqIgkgI0IAICZCAYYiHkIAEEcgA0GQBGoiCiAfQgAgKUIAEEcgA0HQBGoiDCAhQgAgIUIAEEcgA0HAA2oiDSAHQQhqKQMAQgBCgIDEnoCAwABCABBHIANB0AVqIgcgI0IAICNCABBHIANBoANqIgsgIkIAIB5CABBHIANB8ANqIhQgH0IAICFCAYZCABBHIAMpA6AEIiogAykD4AR8IikgAykD0AN8ISYgJiApVK0gCEEIaikDACApICpUrSAEQQhqKQMAIAVBCGopAwB8fHx8IihCDIYgJkI0iIQgAykDkAQiJyADKQPQBHwiKiADKQOwA3wiJCADKQPAA3wiI3whKSADQZADaiIIICMgKVatICMgJFStIA1BCGopAwAgJCAqVK0gCUEIaikDACAnICpWrSAKQQhqKQMAIAxBCGopAwB8fHx8fHwgKEI0iHx8IiNCDIYgKUI0iIQgAykDoAMiKCADKQPwA3wiKnwiJEIEhkLw/////////wCDIClCMIhCD4OEQgBC0YeAgBBCABBHIANBoAVqIgkgIkIAICBCABBHIANBgANqIgQgIUIAIB5CABBHIANBgARqIgUgH0IAIB9CABBHIANB8AJqIgogJCAqVK0gKCAqVq0gC0EIaikDACAUQQhqKQMAfHwgI0I0iHx8IiNCDIYgJEI0iIQgAykDgAMiKCADKQOABHwiKnwiJEL/////////B4NCAEKQ+oCAgAJCABBHIANBwARqIgwgIUIAICBCABBHIANBkAVqIg0gIkIAICJCABBHIANB4AJqIgsgH0IAIB5CABBHIANB0AJqIhQgJCAqVK0gKCAqVq0gBEEIaikDACAFQQhqKQMAfHwgI0I0iHx8Ih5CDIYgJEI0iIQiICADKQPgAnwiIUIAQpD6gICAAkIAEEcgA0HAAmoiHCAgICFWrSALQQhqKQMAIB5CNIh8fEIAQoCAxJ6AgMAAQgAQRyADQZALaiIEIAQgA0G4C2oQJCADQUBrIgQgAykD2AoiHkIAICVCAYYiJEIAEEcgA0GQAmoiBSADKQPQCiIgQgAgAykDyAoiIUIBhiIqQgAQRyADQeABaiILIAMpA+AKIh9CACAfQgAQRyADQdABaiIVIAMpA+ABQgBCkPqAgIACQgAQRyADQbABaiIYIB9CAYYiIkIAICVCABBHIANB0ABqIhkgHkIAICpCABBHIANBgAJqIhogIEIAICBCABBHIANBwAFqIhYgC0EIaikDAEIAQoCAxJ6AgMAAQgAQRyADQeAHaiILICVCACAlQgAQRyADQaABaiIbICJCACAhQgAQRyADQeAAaiIdIB5CACAgQgGGQgAQRyADKQNAIiUgAykDkAJ8Ih8gAykD0AF8ISogHyAqVq0gFUEIaikDACAfICVUrSAEQQhqKQMAIAVBCGopAwB8fHx8IidCDIYgKkI0iIQgAykDUCIrIAMpA4ACfCIlIAMpA7ABfCIjIAMpA8ABfCIofCEfIAMgHyAoVK0gIyAoVq0gFkEIaikDACAjICVUrSAYQQhqKQMAICUgK1StIBlBCGopAwAgGkEIaikDAHx8fHx8fCAnQjSIfHwiKEIMhiAfQjSIhCADKQOgASInIAMpA2B8IiV8IiNCBIZC8P////////8AgyAfQjCIQg+DhEIAQtGHgIAQQgAQRyADQbACaiIEICFCACAkQgAQRyADQZABaiIFICJCACAgQgAQRyADQfAAaiIVIB5CACAeQgAQRyADQTBqIhggIyAlVK0gJSAnVK0gG0EIaikDACAdQQhqKQMAfHwgKEI0iHx8IihCDIYgI0I0iIQgAykDkAEiJyADKQNwfCIlfCIjQv////////8Hg0IAQpD6gICAAkIAEEcgA0HwAWoiGSAgQgAgJEIAEEcgA0GgAmoiGiAhQgAgIUIAEEcgA0GAAWoiFiAiQgAgHkIAEEcgA0EgaiIbICMgJVStICUgJ1StIAVBCGopAwAgFUEIaikDAHx8IChCNIh8fCIeQgyGICNCNIiEIiAgAykDgAF8IiFCAEKQ+oCAgAJCABBHIANBEGoiFSAgICFWrSAWQQhqKQMAIB5CNIh8fEIAQoCAxJ6AgMAAQgAQRyAAQdAAaiATIA8QJCABKAJ4IRYgACADKQOQCyIiIAMpAwAiICADKQPgB3wiHkL/////////B4N8IiU3AwAgAEEIaiITIAMpA5gLIiEgHiAgVK0gA0EIaikDACALQQhqKQMAfHwiJEIMhiAeQjSIhCADKQMwIiMgAykDsAJ8Ih58IiBC/////////weDfCIoNwMAIBcgISAoQgGGfDcDACAAQRBqIg8gAykDoAsiKCAeICBWrSAeICNUrSAYQQhqKQMAIARBCGopAwB8fCAkQjSIfHwiJEIMhiAgQjSIhCADKQPwASIjIAMpA6ACfCIeIAMpAyB8IiB8IiFC/////////weDfCInNwMAIBEgKCAnQgGGfDcDACAAQRhqIgQgAykDqAsiKCAgICFWrSAeICBWrSAbQQhqKQMAIB4gI1StIBlBCGopAwAgGkEIaikDAHx8fHwgJEI0iHx8IiRCDIYgIUI0iIQgAykDECIhICpC/v///////weDfCIefCIgQv////////8Hg3wiKjcDACASICggKkIBhnw3AwAgAEEgaiIFIAMpA7ALIiogH0L///////8/gyAeICBWrSAVQQhqKQMAIB4gIVStfCAkQjSIfHxCDIYgIEI0iIR8fCIeNwMAIBAgKiAeQgGGfDcDACADICIgJUIBhnw3A4gMIAdBCGopAwAhKyAIQQhqKQMAIS8gAykD0AUhKCADKQOQAyEeIAlBCGopAwAhLSAKQQhqKQMAIS4gAykDoAUhMCADKQPwAiEgIA1BCGopAwAhMSAMQQhqKQMAITMgAykDkAUhNiADKQPABCEfIBRBCGopAwAhNyADKQPQAiEsIAMpA8ACISIgHEEIaikDACE0IABB6ABqIgcpAwAhKiAAQeAAaiIIKQMAISUgAEHYAGoiCSkDACEkIABB8ABqIgopAwAhISAAKQNQISMgDiAOIANBwApqECRCAEL4wv////7/PyADKQOIDCA1IB4gKHwiKEL/////////B4MgBht8fSI1QgGDfSEnIB4gKFatICsgL3x8IitCDIYgKEI0iIQgICAwfCIofCEeIB4gKFStICAgKFatIC0gLnx8ICtCNIh8fCIvQgyGIB5CNIiEIB8gNnwiKCAsfCIrfCEgICIgJkL+////////B4N8IiYgICArVK0gKCArVq0gNyAfIChWrSAxIDN8fHx8IC9CNIh8fCIoQgyGICBCNIiEfCEfIABByABqIg4gJ0IQiCAQKQMAIDIgKUL///////8/gyAfICZUrSA0ICIgJlatfCAoQjSIfHxCDIYgH0I0iIR8IAYbfH1C+P///////wN8IilCAYgiMjcDACAAQUBrIhAgKUIzhkKAgICAgICABIMgJ0IMiCIpIBIpAwAgOCAfQv////////8HgyAGG3x9Qvj///////8/fCIfQgGIfCImNwMAIABBOGoiEiAfQjOGQoCAgICAgIAEgyApIBEpAwAgOSAgQv////////8HgyAGG3x9Qvj///////8/fCIgQgGIfCIfNwMAIABBMGoiESAgQjOGQoCAgICAgIAEgyApIBcpAwAgOiAeQv////////8HgyAGG3x9Qvj///////8/fCIeQgGIfCIiNwMAIAAgHkIzhkKAgICAgICABIMgKUKv+P//7///B4MgNXxCAYh8Iik3AyggAEIAIAE0AngiHn0iICACKQMAgyAeQgF9Ih4gACkDAIOENwMAIBMgAikDCCAggyATKQMAIB6DhDcDACAPIAIpAxAgIIMgDykDACAeg4Q3AwAgBCACKQMYICCDIAQpAwAgHoOENwMAIAUgAikDICAggyAFKQMAIB6DhDcDACAAIAIpAyggIIMgHiApg4Q3AyggESACQTBqKQMAICCDIB4gIoOENwMAIBIgAkE4aikDACAggyAeIB+DhDcDACAQIAJBQGspAwAgIIMgHiAmg4Q3AwAgAkHIAGopAwAhKCAAICFC////////P4MgKiAlICQgIyAhQjCIQtGHgIAQfnwiH0I0iHwiKUI0iHwiJkI0iHwiIkI0iHwiJyAfICmEICaEICKEQv////////8Hg4RQBH9BAQUgH0LQh4CAEIUgJ0KAgICAgIDAB4WDICmDICaDICKDQv////////8HUQsgFkF/c3E2AnggCiAeICGDNwMAIAcgHiAqgzcDACAIIB4gJYM3AwAgCSAeICSDNwMAIAAgHiAjgyAgQgGDhDcDUCAOICAgKIMgHiAyg4Q3AwAgA0HQDWokAAu5CQIKfw9+IwBB0AJrIgIkACACQUBrIgQgASkDGCINQgAgASkDACIOQgGGIhZCABBHIAJBkAJqIgUgASkDECIPQgAgASkDCCITQgGGIhdCABBHIAJB4AFqIgMgASkDICIQQgAgEEIAEEcgAkHQAWoiASACKQPgAUIAQpD6gICAAkIAEEcgAkGwAWoiBiAQQgGGIhBCACAOQgAQRyACQdAAaiIHIA1CACAXQgAQRyACQYACaiIIIA9CACAPQgAQRyACQcABaiIJIANBCGopAwBCAEKAgMSegIDAAEIAEEcgAkHAAmoiAyAOQgAgDkIAEEcgAkGgAWoiCiAQQgAgE0IAEEcgAkHgAGoiCyANQgAgD0IBhkIAEEcgAikDQCIMIAIpA5ACfCIOIAIpA9ABfCIXIA5UrSABQQhqKQMAIAwgDlatIARBCGopAwAgBUEIaikDAHx8fHwiFEIMhiAXQjSIhCACKQNQIhUgAikDgAJ8IgwgAikDsAF8IhEgAikDwAF8IhJ8IQ4gAiAOIBJUrSARIBJWrSAJQQhqKQMAIAwgEVatIAZBCGopAwAgDCAVVK0gB0EIaikDACAIQQhqKQMAfHx8fHx8IBRCNIh8fCIUQgyGIA5CNIiEIAIpA6ABIhUgAikDYHwiDHwiEUIEhkLw/////////wCDIA5CMIhCD4OEQgBC0YeAgBBCABBHIAAgAikDACIYIAIpA8ACfCISQv////////8HgzcDACACQbACaiIBIBNCACAWQgAQRyACQZABaiIEIBBCACAPQgAQRyACQfAAaiIFIA1CACANQgAQRyACQTBqIgYgDCARVq0gDCAVVK0gCkEIaikDACALQQhqKQMAfHwgFEI0iHx8IhVCDIYgEUI0iIQgAikDkAEiGSACKQNwfCIMfCIRQv////////8Hg0IAQpD6gICAAkIAEEcgACASIBhUrSACQQhqKQMAIANBCGopAwB8fCIYQgyGIBJCNIiEIAIpAzAiGiACKQOwAnwiEnwiFEL/////////B4M3AwggAkHwAWoiAyAPQgAgFkIAEEcgAkGgAmoiByATQgAgE0IAEEcgAkGAAWoiCCAQQgAgDUIAEEcgAkEgaiIJIAwgEVatIAwgGVStIARBCGopAwAgBUEIaikDAHx8IBVCNIh8fCIQQgyGIBFCNIiEIhYgAikDgAF8IgxCAEKQ+oCAgAJCABBHIAAgEiAUVq0gEiAaVK0gBkEIaikDACABQQhqKQMAfHwgGEI0iHx8IhFCDIYgFEI0iIQgAikD8AEiEiACKQOgAnwiDSACKQMgfCIPfCITQv////////8HgzcDECACQRBqIgEgDCAWVK0gCEEIaikDACAQQjSIfHxCAEKAgMSegIDAAEIAEEcgACAPIBNWrSANIA9WrSAJQQhqKQMAIA0gElStIANBCGopAwAgB0EIaikDAHx8fHwgEUI0iHx8IhBCDIYgE0I0iIQgAikDECITIBdC/v///////weDfCINfCIPQv////////8HgzcDGCAAIA5C////////P4MgDSAPVq0gAUEIaikDACANIBNUrXwgEEI0iHx8QgyGIA9CNIiEfDcDICACQdACaiQAC9MOAgx/Fn4jAEHQA2siAiQAIAAgASgCeDYCeCAAQdAAaiABQdAAaiABQShqIgMQJCACQYADaiADEDggAkGoA2oiAyABEDggAkK84f//v///HyACKQOAAyISfTcD2AIgAkL8////////HyACKQOIAyIRfTcD4AIgAkL8////////HyACKQOQAyIOfTcD6AIgAkL8////////HyACKQOYAyIPfTcD8AIgAiACKQPIA0IDfkIAIAIpA6gDQgN+IhZCAYN9IhBCEIh8IhNCAYg3A8gDIAIgE0IzhkKAgICAgICABIMgEEIMiCIQIAIpA8ADQgN+fCITQgGIfDcDwAMgAiATQjOGQoCAgICAgIAEgyACKQO4A0IDfiAQfCITQgGIfDcDuAMgAiATQjOGQoCAgICAgIAEgyAQIAIpA7ADQgN+fCITQgGIfDcDsAMgAiATQjOGQoCAgICAgIAEgyAQQq/4///v//8HgyAWfEIBiHw3A6gDIAJC/P///////wEgAikDoAMiEH03A/gCIAJB2AJqIg0gDSABECQgACADEDggACAAKQMgIAIpA/gCIhlCAYZ8Iho3AyAgACAAKQMYIAIpA/ACIhtCAYZ8Ihw3AxggACAAKQMQIAIpA+gCIh1CAYZ8Ih43AxAgACAAKQMIIAIpA+ACIh9CAYZ8IiA3AwggACAAKQMAIAIpA9gCIiFCAYZ8IiI3AwAgAkHoAGoiASAPQgAgEkIBhiIWQgAQRyACQagBaiIFIA5CACARQgGGIhNCABBHIAJByAJqIgYgEEIAIBBCABBHIAJBuAJqIgQgAikDyAJCAEKQ+oCAgAJCABBHIAJBiAFqIgcgEEIBhiIQQgAgEkIAEEcgAkGYAWoiCCAPQgAgE0IAEEcgAkHoAWoiCSAOQgAgDkIAEEcgAkGoAmoiCiAGQQhqKQMAQgBCgIDEnoCAwABCABBHIAJB+ABqIgYgEkIAIBJCABBHIAJByAFqIgsgEEIAIBFCABBHIAJB+AFqIgwgD0IAIA5CAYZCABBHIAIpA2giFCACKQOoAXwiEiACKQO4AnwiEyASVK0gBEEIaikDACASIBRUrSABQQhqKQMAIAVBCGopAwB8fHx8IhhCDIYgE0I0iIQgAikDmAEiIyACKQPoAXwiFCACKQOIAXwiFSACKQOoAnwiF3whEiACQShqIgEgEiAXVK0gFSAXVq0gCkEIaikDACAUIBVWrSAHQQhqKQMAIBQgI1StIAhBCGopAwAgCUEIaikDAHx8fHx8fCAYQjSIfHwiF0IMhiASQjSIhCACKQPIASIYIAIpA/gBfCIUfCIVQgSGQvD/////////AIMgEkIwiEIPg4RCAELRh4CAEEIAEEcgAkEYaiIFIBFCACAWQgAQRyACQdgBaiIEIBBCACAOQgAQRyACQZgCaiIHIA9CACAPQgAQRyACQdgAaiIIIBQgFVatIBQgGFStIAtBCGopAwAgDEEIaikDAHx8IBdCNIh8fCIXQgyGIBVCNIiEIAIpA9gBIhggAikDmAJ8IhR8IhVC/////////weDQgBCkPqAgIACQgAQRyACQQhqIgkgDkIAIBZCABBHIAJBuAFqIgogEUIAIBFCABBHIAJBiAJqIgsgEEIAIA9CABBHIAJByABqIgwgFCAVVq0gFCAYVK0gBEEIaikDACAHQQhqKQMAfHwgF0I0iHx8Ig5CDIYgFUI0iIQiDyACKQOIAnwiEUIAQpD6gICAAkIAEEcgAkE4aiIEIA8gEVatIAtBCGopAwAgDkI0iHx8QgBCgIDEnoCAwABCABBHIAIgGSAafDcD+AIgAiAbIBx8NwPwAiACIB0gHnw3A+gCIAIgHyAgfDcD4AIgAiAhICJ8NwPYAiAAQShqIA0gAxAkIABCmtL//5///y8gACkDKCACKQMoIg8gAikDeHwiDkL/////////B4N8fTcDKCAAQTBqIgNC+v///////y8gAykDACAOIA9UrSABQQhqKQMAIAZBCGopAwB8fCIRQgyGIA5CNIiEIAIpA1giECACKQMYfCIOfCIPQv////////8Hg3x9NwMAIABBOGoiAUL6////////LyABKQMAIA4gD1atIA4gEFStIAhBCGopAwAgBUEIaikDAHx8IBFCNIh8fCIQQgyGIA9CNIiEIAIpAwgiFiACKQO4AXwiDiACKQNIfCIPfCIRQv////////8Hg3x9NwMAIABBQGsiAUL6////////LyABKQMAIA8gEVatIA4gD1atIAxBCGopAwAgDiAWVK0gCUEIaikDACAKQQhqKQMAfHx8fCAQQjSIfHwiEEIMhiARQjSIhCACKQM4IhEgE0L+////////B4N8Ig58Ig9C/////////weDfH03AwAgAEHIAGoiAEL6////////AiAAKQMAIBJC////////P4MgDiAPVq0gBEEIaikDACAOIBFUrXwgEEI0iHx8QgyGIA9CNIiEfHx9NwMAIAJB0ANqJAAL4QYCBH8HfiMAQdAAayICJAACQCABKAJ4BEAgAEEBNgJQIABB0AAQRhoMAQsgAUHYAGoiBCkDACABKQNQIAFB8ABqKQMAIghCMIhC0YeAgBB+fCIMQjSIfCIGQv////////8HgyEHIAFB6ABqKQMAIAFB4ABqKQMAIAZCNIh8IglCNIh8IgpC/////////weDIQsgAUHQAGohBSAGIAlC/////////weDIgmDIAqDQv////////8HUSAIQv///////z+DIApCNIh8IgZC////////P1FxIAxC/////////weDIgpCrvj//+///wdWca0gBkIwiIRCAFIEQCAKQtGHgIAQfCIIQv////////8HgyEKIAcgCEI0iHwiCEL/////////B4MhByAJIAhCNIh8IghC/////////weDIQkgCyAIQjSIfCIIQv////////8HgyELIAhCNIggBnxC////////P4MhBgsgAiAGQiiINwNIIAIgBkIWhkKAgID+/////z+DIAtCHoiENwNAIAIgC0IghkKAgICA8P///z+DIAlCFIiENwM4IAIgCUIqhkKAgICAgID//z+DIAdCCoiENwMwIAIgCiAHQjSGQoCAgICAgID4P4OENwMoIAJBKGoiA0GgkioQKiABIAIpAygiBkL/////////B4M3A1AgASACKQNIQiiGIAIpA0AiB0IWiIQ3A3AgASAHQh6GQoCAgID8//8HgyACKQM4IgdCIIiENwNoIAEgB0IUhkKAgMD/////B4MgAikDMCIHQiqIhDcDYCABIAdCCoZCgPj//////weDIAZCNIiENwNYIAMgBRA4IAIgBSADECQgASABIAMQJCABQShqIgMgAyACECQgBEIANwMAIARBCGpCADcDACAEQRBqQgA3AwAgBEEYakIANwMAIABBADYCUCABQgE3A1AgACABKQMANwMAIABBCGogAUEIaikDADcDACAAQRBqIAFBEGopAwA3AwAgAEEYaiABQRhqKQMANwMAIABBIGogAUEgaikDADcDACAAQcgAaiABQcgAaikDADcDACAAQUBrIAFBQGspAwA3AwAgAEE4aiABQThqKQMANwMAIABBMGogAUEwaikDADcDACAAIAEpAyg3AygLIAJB0ABqJAAL1wEBAX8jAEGAAWsiAyQAAn8gAUUEQEHmiyogAEGsAWooAgAgAEGoAWooAgARAABBAAwBCyABQgA3AAAgAUE4akIANwAAIAFBMGpCADcAACABQShqQgA3AAAgAUEgakIANwAAIAFBGGpCADcAACABQRBqQgA3AAAgAUEIakIANwAAIAJFBEBBkI4qIABBrAFqKAIAIABBqAFqKAIAEQAAQQAMAQtBACADIAIQIkUNABpBACADQShqIgAgA0EAECNFDQAaIAEgABAlQQELIQIgA0GAAWokACACC7cDAgJ/Bn4jAEHgAGsiAiQAQcWVKkIANwAAQd2VKkIANwAAQdWVKkIANwAAQc2VKkIANwAAAkAgAUUEQEHmiyogAEGsAWooAgAgAEGoAWooAgARAAAMAQsgAkHQAGogASkAOCIEQhCINwMAIAJByABqIARCJIZCgICAgID+/weDIAEpADAiBEIciIQ3AwAgAkFAayAEQhiGQoCAgPj///8HgyABKQAoIgRCKIiENwMAIAJBOGogBEIMhkKA4P//////B4MgASkAICIEQjSIhDcDACACQQA2AlggAiAEQv////////8HgzcDMCACIAEpAAgiBEIMhkKA4P//////B4MgASkAACIFQjSIhCIHNwMQIAIgBUL/////////B4MiBTcDCCACIAEpABgiBkIQiCIINwMoIAIgASkAECIJQhiGQoCAgPj///8HgyAEQiiIhCIENwMYIAIgBkIkhkKAgICAgP7/B4MgCUIciIQiBjcDICAFIAeEIAiEIASEIAaEUARAQcSPKiAAQawBaigCACAAQagBaigCABEAAAwBC0HFlSogAkEIahAnQQEhAwsgAkHgAGokACADC7AEAgJ/DH4jAEHgAGsiBCQAAn8gAUUEQEGyiyogAEGsAWooAgAgAEGoAWooAgARAABBAAwBCyADRQRAQeaLKiAAQawBaigCACAAQagBaigCABEAAEEADAELIARB0ABqIAMpADgiBkIQiCIKNwMAIARByABqIAZCJIZCgICAgID+/weDIAMpADAiBkIciIQiCzcDACAEQUBrIAZCGIZCgICA+P///weDIAMpACgiBkIoiIQiDDcDACAEQThqIAZCDIZCgOD//////weDIAMpACAiBkI0iIQiDTcDACAEQQA2AlggBCAGQv////////8HgyIONwMwIAQgAykACCIHQgyGQoDg//////8HgyADKQAAIghCNIiEIg83AxAgBCAIQv////////8HgyIINwMIIAQgAykAGCIJQhCIIhA3AyggBCADKQAQIhFCGIZCgICA+P///weDIAdCKIiEIgc3AxggBCAJQiSGQoCAgICA/v8HgyARQhyIhCIJNwMgIAggD4QgEIQgB4QgCYRQBEBBxI8qIABBrAFqKAIAIABBqAFqKAIAEQAAQQAMAQsgBkIBg6cEQCAEQvz///////8BIAp9NwNQIARC/P///////x8gC303A0ggBEL8////////HyAMfTcDQCAEQvz///////8fIA19NwM4IARCvOH//7///x8gDn03AzBBASEFCyACBEAgAiAFNgIACyABIARBCGoQJUEBCyEDIARB4ABqJAAgAwuWAwIGfwV+IwBBgAJrIgIkAAJAIAFFBEBBpIwqIABBrAFqKAIAIABBqAFqKAIAEQAADAELIAFB4AAQRiEFIAAoAgBFBEBB/Y4qIABBrAFqKAIAIABBqAFqKAIAEQAADAELIAJB4ABqIgFB5JQqIAJBgAFqIgMQKCACQgBCfyACKAKAASACKQN4IgwgAikDcCILIAIpA2giCSACKQNgIgqEhIRQciIGGyIIIAyDNwN4IAIgCCALgzcDcCACIAggCYM3A2ggAiAGQQBHIgetIAggCoOENwNgIAAgAyABEDIgAkEIaiIAIAMQMyAFIAEQKSAFQSBqIAAQJSACIAc2AoABIAIoAoABQQFrIQADQCAEIAVqIgEgAS0AACAAcToAACABQQFqIgMgAy0AACAAcToAACABQQJqIgMgAy0AACAAcToAACABQQNqIgMgAy0AACAAcToAACABQQRqIgMgAy0AACAAcToAACABQQVqIgEgAS0AACAAcToAACAEQQZqIgRB4ABHDQALIAZFIQQLIAJBgAJqJAAgBAu8DQECfyMAQbABayIIJAAgBQR/AkAgB0UEQCAIIAMtAABB1ABzOgAAIAggAy0AAUHxAXM6AAEgCCADLQACQekAczoAAiAIIAMtAANBzwFzOgADIAggAy0ABEHJAXM6AAQgCCADLQAFQeIBczoABSAIIAMtAAZB5QFzOgAGIAggAy0AB0HyAHM6AAcgCCADLQAIQfQAczoACCAIIAMtAAlBgAFzOgAJIAggAy0ACkHEAHM6AAogCCADLQALQR9zOgALIAggAy0ADEGQAXM6AAwgCCADLQANQboBczoADSAIIAMtAA5BJXM6AA4gCCADLQAPQcQBczoADyAIIAMtABBBiAFzOgAQIAggAy0AEUH0AXM6ABEgCCADLQASQeEAczoAEiAIIAMtABNBxwFzOgATIAggAy0AFEELczoAFCAIIAMtABVB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NgIAIAEhBAsgACIBQYEBSA0ACyADQSBqJAAgBEEBagvSBQIDfwV+AkAgAkEASgRAIAAgASACQQV0QSBrQUBxaiIBKQMAQv////////8HgzcDACAAIAEpAwhCDIZCgOD//////weDIAEpAwBCNIiENwMIIAAgASkDEEIYhkKAgID4////B4MgASkDCEIoiIQ3AxAgACABKQMYQiSGQoCAgICA/v8HgyABKQMQQhyIhDcDGCAAIAEpAxhCEIg3AyAgACABKQMgQv////////8HgzcDKCAAQTBqIAFBKGoiAikDAEIMhkKA4P//////B4MgASkDIEI0iIQ3AwAgAEE4aiABQTBqIgMpAwBCGIZCgICA+P///weDIAIpAwBCKIiENwMAIABBQGsgAUE4aiIBKQMAQiSGQoCAgICA/v8HgyADKQMAQhyIhDcDACAAQcgAaiABKQMAQhCINwMADAELIAAgASACQX9zQQV0QUBxaiIBKQMAQv////////8HgzcDACAAIAEpAwhCDIZCgOD//////weDIAEpAwBCNIiENwMIIAAgASkDEEIYhkKAgID4////B4MgASkDCEIoiIQ3AxAgACABKQMYQiSGQoCAgICA/v8HgyABKQMQQhyIhDcDGCAAIAEpAxhCEIg3AyAgACABKQMgQv////////8HgyIGNwMoIABBMGoiAiABQShqIgMpAwBCDIZCgOD//////weDIAEpAyBCNIiEIgc3AwAgAEE4aiIEIAFBMGoiBSkDAEIYhkKAgID4////B4MgAykDAEIoiIQiCDcDACAAQUBrIgMgAUE4aiIBKQMAQiSGQoCAgICA/v8HgyAFKQMAQhyIhCIJNwMAIAEpAwAhCiADQvz///////8fIAl9NwMAIARC/P///////x8gCH03AwAgAkL8////////HyAHfTcDACAAQrzh//+///8fIAZ9NwMoIABByABqQvz///////8BIApCEIh9NwMACyAAQQA2AlALsyACDn8QfiMAQeAIayIEJAACQCABKAJ4BEAgACACKAJQNgJ4IARBuAhqIgEgAxA4IARBkAhqIgUgASADECQgACACIAEQJCAAQShqIAJBKGogBRAkIABB2ABqQgA3AwAgAEIBNwNQIABB4ABqQgA3AwAgAEHoAGpCADcDACAAQfAAakIANwMADAELIAIoAlAEQCAAIAFBgAEQSBoMAQsgBEG4CGoiCyABQdAAaiIMIAMQJCAEQZgDaiIDIAQpA9AIIhJCACAEKQO4CCIVQgGGIhxCABBHIARB6ARqIgUgBCkDyAgiE0IAIAQpA8AIIhRCAYYiGkIAEEcgBEG4BGoiBiAEKQPYCCIWQgAgFkIAEEcgBEGoBGoiCCAEKQO4BEIAQpD6gICAAkIAEEcgBEGIBGoiByAWQgGGIhZCACAVQgAQRyAEQagDaiIJIBJCACAaQgAQRyAEQdgEaiIKIBNCACATQgAQRyAEQZgEaiINIAZBCGopAwBCAEKAgMSegIDAAEIAEEcgBEGYBWoiDiAVQgAgFUIAEEcgBEH4A2oiDyAWQgAgFEIAEEcgBEG4A2oiECASQgAgE0IBhkIAEEcgBCkDmAMiFyAEKQPoBHwiFSAEKQOoBHwhGiAVIBpWrSAIQQhqKQMAIBUgF1StIANBCGopAwAgBUEIaikDAHx8fHwiG0IMhiAaQjSIhCAEKQOoAyIdIAQpA9gEfCIXIAQpA4gEfCIYIAQpA5gEfCIZfCEVIARB2AJqIhEgFSAZVK0gGCAZVq0gDUEIaikDACAXIBhWrSAHQQhqKQMAIBcgHVStIAlBCGopAwAgCkEIaikDAHx8fHx8fCAbQjSIfHwiG0IMhiAVQjSIhCAEKQP4AyIdIAQpA7gDfCIXfCIYQgSGQvD/////////AIMgFUIwiEIPg4RCAELRh4CAEEIAEEcgBEHoB2oiA0EIaiIFIAFBCGopAwA3AwAgA0EQaiIGIAFBEGopAwA3AwAgA0EYaiIIIAFBGGopAwA3AwAgA0EgaiIDIAFBIGopAwA3AwAgBCABKQMANwPoByAEIAQpA9gCIh4gBCkDmAV8IhlC/////////weDNwOQCCAEQYgFaiIHIBRCACAcQgAQRyAEQegDaiIJIBZCACATQgAQRyAEQcgDaiIKIBJCACASQgAQRyAEQYgDaiINIBcgGFatIBcgHVStIA9BCGopAwAgEEEIaikDAHx8IBtCNIh8fCIdQgyGIBhCNIiEIAQpA+gDIh8gBCkDyAN8Ihd8IhhC/////////weDQgBCkPqAgIACQgAQRyAEIBkgHlStIBFBCGopAwAgDkEIaikDAHx8Ih5CDIYgGUI0iIQgBCkDiAMiICAEKQOIBXwiGXwiG0L/////////B4M3A5gIIARByARqIg4gE0IAIBxCABBHIARB+ARqIg8gFEIAIBRCABBHIARB2ANqIhAgFkIAIBJCABBHIARB+AJqIhEgFyAYVq0gFyAfVK0gCUEIaikDACAKQQhqKQMAfHwgHUI0iHx8IhZCDIYgGEI0iIQiHCAEKQPYA3wiF0IAQpD6gICAAkIAEEcgBCAZIBtWrSAZICBUrSANQQhqKQMAIAdBCGopAwB8fCAeQjSIfHwiGEIMhiAbQjSIhCAEKQPIBCIZIAQpA/gEfCISIAQpA/gCfCITfCIUQv////////8HgzcDoAggBEHoAmoiByAXIBxUrSAQQQhqKQMAIBZCNIh8fEIAQoCAxJ6AgMAAQgAQRyAEIBMgFFatIBIgE1atIBFBCGopAwAgEiAZVK0gDkEIaikDACAPQQhqKQMAfHx8fCAYQjSIfHwiFkIMhiAUQjSIhCAEKQPoAiIUIBpC/v///////weDfCISfCITQv////////8HgzcDqAggBCAVQv///////z+DIBIgE1atIAdBCGopAwAgEiAUVK18IBZCNIh8fEIMhiATQjSIhHw3A7AIIAUgBSkDACAEKQPoByADKQMAIhJCMIhC0YeAgBB+fCITQjSIfCIUQv////////8HgyIWNwMAIAYgBikDACAUQjSIfCIUQv////////8HgyIaNwMAIAggCCkDACAUQjSIfCIUQv////////8HgyIcNwMAIAMgEkL///////8/gyAUQjSIfCIXNwMAIAQgE0L/////////B4MiEjcD6AcgBEHAB2ogAiAEQZAIaiIFECQgBEGYB2oiA0EIaiABQTBqKQMAIAEpAyggAUHIAGopAwAiE0IwiELRh4CAEH58IhRCNIh8IhVC/////////weDIhg3AwAgA0EQaiABQThqKQMAIBVCNIh8IhVC/////////weDIhk3AwAgA0EYaiABQUBrKQMAIBVCNIh8IhVC/////////weDIhs3AwAgA0EgaiATQv///////z+DIBVCNIh8Ih03AwAgBCAUQv////////8HgyIeNwOYByAEQfAGaiIDIAJBKGogBRAkIAMgAyALECQgBCAEKQPAByASfUK84f//v///H3wiFTcDyAYgBCAEKQPIByAWfUL8////////H3wiFDcD0AYgBCAEKQPQByAafUL8////////H3wiEjcD2AYgBCAEKQPYByAcfUL8////////H3wiEzcD4AYgBCAEKQPgByAXfUL8////////AXwiFjcD6AYgBCAdIAQpA5AHfUL8////////AXwiGjcDwAYgBCAbIAQpA4gHfUL8////////H3wiHTcDuAYgBCAZIAQpA4AHfUL8////////H3wiHzcDsAYgBCAYIAQpA/gGfUL8////////H3wiIDcDqAYgBCAeIAQpA/AGfUK84f//v///H3wiHjcDoAYgFkIwiELRh4CAEH4gFXwiHEL/////////B4MiGELQh4CAEIUhFwJAIBhCAFIgF0L/////////B1JxDQAgFkL///////8/gyAcQjSIIBR8IhhCNIggEnwiGUI0iCATfCIbQjSIfCIhIBggHIQgGYQgG4RC/////////weDhEIAUgRAIBcgIUKAgICAgIDAB4WDIBiDIBmDIBuDQv////////8HUg0BCyAaQjCIQtGHgIAQfiAefCISQv////////8HgyIUQtCHgIAQhSETAkAgFEIAUiATQv////////8HUnENACAaQv///////z+DIBJCNIggIHwiFEI0iCAffCIVQjSIIB18IhZCNIh8IhogEiAUhCAVhCAWhEL/////////B4OEQgBSBEAgEyAaQoCAgICAgMAHhYMgFIMgFYMgFoNC/////////wdSDQELIAAgARA5DAILIABBATYCeCAAQfgAEEYaDAELIABBADYCeCAAQdAAaiAMIARByAZqIgIQJCAEQbgCaiIBIBNCACAVQgGGIhxCABBHIARB6AFqIgMgEkIAIBRCAYYiGkIAEEcgBEGoAWoiBSAWQgAgFkIAEEcgBEGYAWoiBiAEKQOoAUIAQpD6gICAAkIAEEcgBEH4AGoiCCAWQgGGIhZCACAVQgAQRyAEQZgCaiILIBNCACAaQgAQRyAEQdgBaiIMIBJCACASQgAQRyAEQYgBaiIHIAVBCGopAwBCAEKAgMSegIDAAEIAEEcgBEHIAmoiBSAVQgAgFUIAEEcgBEHoAGoiCSAWQgAgFEIAEEcgBEG4AWoiCiATQgAgEkIBhkIAEEcgBCkDuAIiFyAEKQPoAXwiFSAEKQOYAXwhGiAVIBpWrSAGQQhqKQMAIBUgF1StIAFBCGopAwAgA0EIaikDAHx8fHwiG0IMhiAaQjSIhCAEKQOYAiIdIAQpA9gBfCIXIAQpA3h8IhggBCkDiAF8Ihl8IRUgBEHYAGoiASAVIBlUrSAYIBlWrSAHQQhqKQMAIBcgGFatIAhBCGopAwAgFyAdVK0gC0EIaikDACAMQQhqKQMAfHx8fHx8IBtCNIh8fCIZQgyGIBVCNIiEIAQpA2giGyAEKQO4AXwiF3wiGEIEhkLw/////////wCDIBVCMIhCD4OEQgBC0YeAgBBCABBHIARBiAJqIgMgFEIAIBxCABBHIARByABqIgYgFkIAIBJCABBHIARBqAJqIgggE0IAIBNCABBHIARBOGoiCyAXIBhWrSAXIBtUrSAJQQhqKQMAIApBCGopAwB8fCAZQjSIfHwiGUIMhiAYQjSIhCAEKQNIIhsgBCkDqAJ8Ihd8IhhC/////////weDQgBCkPqAgIACQgAQRyAEQcgBaiIMIBJCACAcQgAQRyAEQfgBaiIHIBRCACAUQgAQRyAEQShqIgkgFkIAIBNCABBHIARBGGoiCiAXIBhWrSAXIBtUrSAGQQhqKQMAIAhBCGopAwB8fCAZQjSIfHwiEkIMhiAYQjSIhCITIAQpAyh8IhRCAEKQ+oCAgAJCABBHIARBCGoiBiATIBRWrSAJQQhqKQMAIBJCNIh8fEIAQoCAxJ6AgMAAQgAQRyAEQrzh//+///8fIAQpA1giEyAEKQPIAnwiEkL/////////B4N9NwP4BSAEQvz///////8fIBIgE1StIAFBCGopAwAgBUEIaikDAHx8IhRCDIYgEkI0iIQgBCkDOCIWIAQpA4gCfCISfCITQv////////8Hg303A4AGIARC/P///////x8gEiATVq0gEiAWVK0gC0EIaikDACADQQhqKQMAfHwgFEI0iHx8IhZCDIYgE0I0iIQgBCkDyAEiHCAEKQP4AXwiEiAEKQMYfCITfCIUQv////////8Hg303A4gGIARC/P///////x8gEyAUVq0gEiATVq0gCkEIaikDACASIBxUrSAMQQhqKQMAIAdBCGopAwB8fHx8IBZCNIh8fCIWQgyGIBRCNIiEIAQpAwgiFCAaQv7///////8Hg3wiEnwiE0L/////////B4N9NwOQBiAEQvz///////8BIBVC////////P4MgEiATVq0gBkEIaikDACASIBRUrXwgFkI0iHx8QgyGIBNCNIiEfH03A5gGIARB0AVqIgEgBEH4BWoiAyACECQgBEGoBWoiAiAEQegHaiADECQgACAEQaAGaiIDEDggACAAKQMgIAQpA/AFfCAEKQPIBSISQgGGfCITNwMgIAAgACkDGCAEKQPoBXwgBCkDwAUiFEIBhnwiFTcDGCAAIAApAxAgBCkD4AV8IAQpA7gFIhZCAYZ8Iho3AxAgACAAKQMIIAQpA9gFfCAEKQOwBSIcQgGGfCIXNwMIIAAgACkDACAEKQPQBXwgBCkDqAUiGEIBhnwiGTcDACAEIBIgE3w3A8gFIAQgFCAVfDcDwAUgBCAWIBp8NwO4BSAEIBcgHHw3A7AFIAQgGCAZfDcDqAUgAEEoaiACIAMQJCABIAEgBEGYB2oQJCAAIAApAyggBCkD0AV8NwMoIABBMGoiASABKQMAIAQpA9gFfDcDACAAQThqIgEgASkDACAEKQPgBXw3AwAgAEFAayIBIAEpAwAgBCkD6AV8NwMAIABByABqIgAgACkDACAEKQPwBXw3AwALIARB4AhqJAALsxoCCX8QfiMAQeAFayIEJAAgAigCUCEFAkAgASgCeARAIAAgBTYCeCAAIAIpAwA3AwAgAEEIaiACQQhqKQMANwMAIABBEGogAkEQaikDADcDACAAQRhqIAJBGGopAwA3AwAgAEEgaiACQSBqKQMANwMAIAAgAikDKDcDKCAAQTBqIAJBMGopAwA3AwAgAEE4aiACQThqKQMANwMAIABBQGsgAkFAaykDADcDACAAQcgAaiACQcgAaikDADcDACAAQdgAakIANwMAIABCATcDUCAAQeAAakIANwMAIABB6ABqQgA3AwAgAEHwAGpCADcDAAwBCyAFBEAgAwRAIANCADcDCCADQgE3AwAgA0EQakIANwMAIANBGGpCADcDACADQSBqQgA3AwALIAAgAUGAARBIGgwBCyAEQbgFaiIGIAFB0ABqIgcQOCAEQZAFaiIFQQhqIAFBCGopAwAgASkDACABQSBqKQMAIg5CMIhC0YeAgBB+fCINQjSIfCIPQv////////8HgyIRNwMAIAVBEGogAUEQaikDACAPQjSIfCIPQv////////8HgyIUNwMAIAVBGGogAUEYaikDACAPQjSIfCIPQv////////8HgyIWNwMAIAVBIGogDkL///////8/gyAPQjSIfCISNwMAIAQgDUL/////////B4MiDjcDkAUgBEHoBGogAiAGECQgBEHABGoiBUEIaiABQTBqKQMAIAEpAyggAUHIAGopAwAiDUIwiELRh4CAEH58Ig9CNIh8IhBC/////////weDIhM3AwAgBUEQaiABQThqKQMAIBBCNIh8IhBC/////////weDIhU3AwAgBUEYaiABQUBrKQMAIBBCNIh8IhBC/////////weDIhc3AwAgBUEgaiANQv///////z+DIBBCNIh8Ihg3AwAgBCAPQv////////8HgyIZNwPABCAEQZgEaiIFIAJBKGogBhAkIAUgBSAHECQgBCAEKQPoBCAOfUK84f//v///H3wiEDcD8AMgBCAEKQPwBCARfUL8////////H3wiDzcD+AMgBCAEKQP4BCAUfUL8////////H3wiDjcDgAQgBCAEKQOABSAWfUL8////////H3wiDTcDiAQgBCAEKQOIBSASfUL8////////AXwiETcDkAQgBCAYIAQpA7gEfUL8////////AXwiFDcD6AMgBCAXIAQpA7AEfUL8////////H3wiGDcD4AMgBCAVIAQpA6gEfUL8////////H3wiGjcD2AMgBCATIAQpA6AEfUL8////////H3wiGzcD0AMgBCAZIAQpA5gEfUK84f//v///H3wiGTcDyAMgEUIwiELRh4CAEH4gEHwiFkL/////////B4MiE0LQh4CAEIUhEgJAIBNCAFIgEkL/////////B1JxDQAgEUL///////8/gyAWQjSIIA98IhNCNIggDnwiFUI0iCANfCIXQjSIfCIcIBMgFoQgFYQgF4RC/////////weDhEIAUgRAIBIgHEKAgICAgIDAB4WDIBODIBWDIBeDQv////////8HUg0BCyAUQjCIQtGHgIAQfiAZfCIOQv////////8HgyIPQtCHgIAQhSENAkAgD0IAUiANQv////////8HUnENACAUQv///////z+DIA5CNIggG3wiD0I0iCAafCIQQjSIIBh8IhFCNIh8IhQgDiAPhCAQhCARhEL/////////B4OEQgBSBEAgDSAUQoCAgICAgMAHhYMgD4MgEIMgEYNC/////////wdSDQELIAMEQCADIAFBKGoiAikDACINNwMAIANBCGoiBSACQQhqKQMAIg83AwAgA0EQaiIGIAJBEGopAwAiEDcDACADQRhqIgcgAkEYaikDACIRNwMAIANBIGoiCCACQSBqKQMAIg43AwAgAyANIA5CMIhC0YeAgBB+fCINQv////////8HgzcDACAFIA8gDUI0iHwiDUL/////////B4M3AwAgBiAQIA1CNIh8Ig1C/////////weDNwMAIAcgESANQjSIfCINQv////////8HgzcDACAIIA5C////////P4MgDUI0iHw3AwALIAAgARA5DAILIAMEQCADQgA3AwAgA0EgakIANwMAIANBGGpCADcDACADQRBqQgA3AwAgA0EIakIANwMACyAAQQE2AnggAEH4ABBGGgwBCyAAQQA2AnggAwRAIAMgBCkD8AM3AwAgA0EgaiAEQfADaiIBQSBqKQMANwMAIANBGGogAUEYaikDADcDACADQRBqIAFBEGopAwA3AwAgA0EIaiABQQhqKQMANwMACyAAQdAAaiAHIARB8ANqIgIQJCAEQbACaiIBIA1CACAQQgGGIhZCABBHIARB4AFqIgMgDkIAIA9CAYYiFEIAEEcgBEGgAWoiBSARQgAgEUIAEEcgBEGQAWoiBiAEKQOgAUIAQpD6gICAAkIAEEcgBEHwAGoiByARQgGGIhFCACAQQgAQRyAEQZACaiIIIA1CACAUQgAQRyAEQdABaiIJIA5CACAOQgAQRyAEQYABaiIKIAVBCGopAwBCAEKAgMSegIDAAEIAEEcgBEHAAmoiBSAQQgAgEEIAEEcgBEHgAGoiCyARQgAgD0IAEEcgBEGwAWoiDCANQgAgDkIBhkIAEEcgBCkDsAIiEiAEKQPgAXwiECAEKQOQAXwhFCAQIBRWrSAGQQhqKQMAIBAgElStIAFBCGopAwAgA0EIaikDAHx8fHwiF0IMhiAUQjSIhCAEKQOQAiIYIAQpA9ABfCISIAQpA3B8IhMgBCkDgAF8IhV8IRAgBEHQAGoiASAQIBVUrSATIBVWrSAKQQhqKQMAIBIgE1atIAdBCGopAwAgEiAYVK0gCEEIaikDACAJQQhqKQMAfHx8fHx8IBdCNIh8fCIVQgyGIBBCNIiEIAQpA2AiFyAEKQOwAXwiEnwiE0IEhkLw/////////wCDIBBCMIhCD4OEQgBC0YeAgBBCABBHIARBgAJqIgMgD0IAIBZCABBHIARBQGsiBiARQgAgDkIAEEcgBEGgAmoiByANQgAgDUIAEEcgBEEwaiIIIBIgE1atIBIgF1StIAtBCGopAwAgDEEIaikDAHx8IBVCNIh8fCIVQgyGIBNCNIiEIAQpA0AiFyAEKQOgAnwiEnwiE0L/////////B4NCAEKQ+oCAgAJCABBHIARBwAFqIgkgDkIAIBZCABBHIARB8AFqIgogD0IAIA9CABBHIARBIGoiCyARQgAgDUIAEEcgBEEQaiIMIBIgE1atIBIgF1StIAZBCGopAwAgB0EIaikDAHx8IBVCNIh8fCIOQgyGIBNCNIiEIg0gBCkDIHwiD0IAQpD6gICAAkIAEEcgBCANIA9WrSALQQhqKQMAIA5CNIh8fEIAQoCAxJ6AgMAAQgAQRyAEQrzh//+///8fIAQpA1AiDSAEKQPAAnwiDkL/////////B4N9NwOgAyAEQvz///////8fIA0gDlatIAFBCGopAwAgBUEIaikDAHx8Ig9CDIYgDkI0iIQgBCkDMCIRIAQpA4ACfCIOfCINQv////////8Hg303A6gDIARC/P///////x8gDSAOVK0gDiARVK0gCEEIaikDACADQQhqKQMAfHwgD0I0iHx8IhFCDIYgDUI0iIQgBCkDwAEiFiAEKQPwAXwiDiAEKQMQfCINfCIPQv////////8Hg303A7ADIARC/P///////x8gDSAPVq0gDSAOVK0gDEEIaikDACAOIBZUrSAJQQhqKQMAIApBCGopAwB8fHx8IBFCNIh8fCIRQgyGIA9CNIiEIAQpAwAiDyAUQv7///////8Hg3wiDnwiDUL/////////B4N9NwO4AyAEQvz///////8BIBBC////////P4MgDSAOVK0gBEEIaikDACAOIA9UrXwgEUI0iHx8QgyGIA1CNIiEfH03A8ADIARB+AJqIgEgBEGgA2oiAyACECQgBEHQAmoiAiAEQZAFaiADECQgACAEQcgDaiIDEDggACAAKQMgIAQpA5gDfCAEKQPwAiIOQgGGfCINNwMgIAAgACkDGCAEKQOQA3wgBCkD6AIiD0IBhnwiEDcDGCAAIAApAxAgBCkDiAN8IAQpA+ACIhFCAYZ8IhQ3AxAgACAAKQMIIAQpA4ADfCAEKQPYAiIWQgGGfCISNwMIIAAgACkDACAEKQP4AnwgBCkD0AIiE0IBhnwiFTcDACAEIA0gDnw3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IA5UrSAFQQhqKQMAIA98fCEPIAQpA3AiDiARfCIRIA5UrSACQQhqKQMAIBB8fCEQCyAAIBFC//////////8/gzcDECABIBNC//////////8/gzcDECAEQdAAaiICIBcgEiAiICJCP4ciDhBHIARBMGoiBSAYIBwgISAhQj+HIhIQRyAEQUBrIgYgGiAdICIgDhBHIARBIGoiByAbIB4gISASEEcgAykDICIOQj+HIRIgBCAOIBIgFiAWQj+HEEcgBEEQaiIDIA4gEiAUIBRCP4cQRyAAIAQpAzAiFyAEKQNQfCIOIBBCAoYgEUI+iIR8IhIgBCkDAHwiEUL//////////z+DNwMYIAEgD0IChiATQj6IhCAEKQMgIhggBCkDQHwiE3wiFiAEKQMQfCIUQv//////////P4M3AxggACARIBJUrSAEQQhqKQMAIA4gElatIA4gF1StIAVBCGopAwAgAkEIaikDAHx8IBBCPod8fHx8QgKGIBFCPoiENwMgIAEgFCAWVK0gA0EIaikDACATIBZWrSATIBhUrSAHQQhqKQMAIAZBCGopAwB8fCAPQj6HfHx8fEIChiAUQj6IhDcDICAEQeADaiQAC58BAQN/AkAgASICQQ9NBEAgACEBDAELQQAgAGtBA3EiBCAAaiEDIAQEQCAAIQEDQCABQQA6AAAgAyABQQFqIgFLDQALCyACIARrIgJBfHEiBCADaiEBIARBAEoEQANAIANBADYCACADQQRqIgMgAUkNAAsLIAJBA3EhAgsgAgRAIAEgAmohAgNAIAFBADoAACACIAFBAWoiAUsNAAsLIAALcAEGfiADQv////8PgyIFIAFC/////w+DIgZ+IQcgACAHIAYgA0IgiCIIfiAFIAFCIIgiBn4iCXwiBUIghnwiCjcDACAAIAcgClatIAYgCH4gBSAJVK1CIIYgBUIgiIR8fCABIAR+IAIgA358fDcDCAu3AgEIfwJAIAIiBkEPTQRAIAAhAgwBC0EAIABrQQNxIgUgAGohBCAFBEAgACECIAEhAwNAIAIgAy0AADoAACADQQFqIQMgBCACQQFqIgJLDQALCyAGIAVrIgZBfHEiByAEaiECAkAgASAFaiIFQQNxIgMEQCAHQQBMDQEgBUF8cSIIQQRqIQFBACADQQN0IglrQRhxIQogCCgCACEDA0AgAyAJdiEI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";
    exports.default = (0, base64_arraybuffer_1.decode)(wasm);
  }
});

// node_modules/bells-secp256k1/lib/rand.js
var require_rand = __commonJS({
  "node_modules/bells-secp256k1/lib/rand.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.generateInt32 = generateInt32;
    function get4RandomBytes() {
      const bytes = new Uint8Array(4);
      if (typeof crypto === "undefined") {
        throw new Error("The crypto object is unavailable. This may occur if your environment does not support the Web Cryptography API.");
      }
      crypto.getRandomValues(bytes);
      return bytes;
    }
    function generateInt32() {
      const array = get4RandomBytes();
      return (array[0] << 3 * 8) + (array[1] << 2 * 8) + (array[2] << 1 * 8) + array[3];
    }
  }
});

// node_modules/bells-secp256k1/lib/memory.js
var require_memory = __commonJS({
  "node_modules/bells-secp256k1/lib/memory.js"(exports) {
    "use strict";
    init_buffer_shim();
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate = __importStar(require_validate());
    var Memory = class {
      constructor(wasm) {
        this.WASM_BUFFER = new Uint8Array(wasm.memory.buffer);
        const WASM_PRIVATE_KEY_PTR = wasm.PRIVATE_INPUT.value;
        const WASM_PUBLIC_KEY_INPUT_PTR = wasm.PUBLIC_KEY_INPUT.value;
        const WASM_PUBLIC_KEY_INPUT_PTR2 = wasm.PUBLIC_KEY_INPUT2.value;
        const WASM_X_ONLY_PUBLIC_KEY_INPUT_PTR = wasm.X_ONLY_PUBLIC_KEY_INPUT.value;
        const WASM_X_ONLY_PUBLIC_KEY_INPUT2_PTR = wasm.X_ONLY_PUBLIC_KEY_INPUT2.value;
        const WASM_TWEAK_INPUT_PTR = wasm.TWEAK_INPUT.value;
        const WASM_HASH_INPUT_PTR = wasm.HASH_INPUT.value;
        const WASM_EXTRA_DATA_INPUT_PTR = wasm.EXTRA_DATA_INPUT.value;
        const WASM_SIGNATURE_INPUT_PTR = wasm.SIGNATURE_INPUT.value;
        this.PRIVATE_KEY_INPUT = this.WASM_BUFFER.subarray(WASM_PRIVATE_KEY_PTR, WASM_PRIVATE_KEY_PTR + validate.PRIVATE_KEY_SIZE);
        this.PUBLIC_KEY_INPUT = this.WASM_BUFFER.subarray(WASM_PUBLIC_KEY_INPUT_PTR, WASM_PUBLIC_KEY_INPUT_PTR + validate.PUBLIC_KEY_UNCOMPRESSED_SIZE);
        this.PUBLIC_KEY_INPUT2 = this.WASM_BUFFER.subarray(WASM_PUBLIC_KEY_INPUT_PTR2, WASM_PUBLIC_KEY_INPUT_PTR2 + validate.PUBLIC_KEY_UNCOMPRESSED_SIZE);
        this.X_ONLY_PUBLIC_KEY_INPUT = this.WASM_BUFFER.subarray(WASM_X_ONLY_PUBLIC_KEY_INPUT_PTR, WASM_X_ONLY_PUBLIC_KEY_INPUT_PTR + validate.X_ONLY_PUBLIC_KEY_SIZE);
        this.X_ONLY_PUBLIC_KEY_INPUT2 = this.WASM_BUFFER.subarray(WASM_X_ONLY_PUBLIC_KEY_INPUT2_PTR, WASM_X_ONLY_PUBLIC_KEY_INPUT2_PTR + validate.X_ONLY_PUBLIC_KEY_SIZE);
        this.TWEAK_INPUT = this.WASM_BUFFER.subarray(WASM_TWEAK_INPUT_PTR, WASM_TWEAK_INPUT_PTR + validate.TWEAK_SIZE);
        this.HASH_INPUT = this.WASM_BUFFER.subarray(WASM_HASH_INPUT_PTR, WASM_HASH_INPUT_PTR + validate.HASH_SIZE);
        this.EXTRA_DATA_INPUT = this.WASM_BUFFER.subarray(WASM_EXTRA_DATA_INPUT_PTR, WASM_EXTRA_DATA_INPUT_PTR + validate.EXTRA_DATA_SIZE);
        this.SIGNATURE_INPUT = this.WASM_BUFFER.subarray(WASM_SIGNATURE_INPUT_PTR, WASM_SIGNATURE_INPUT_PTR + validate.SIGNATURE_SIZE);
      }
    };
    exports.default = Memory;
  }
});

// node_modules/bells-secp256k1/lib/index.js
var require_lib = __commonJS({
  "node_modules/bells-secp256k1/lib/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    var __importDefault = exports && exports.__importDefault || function(mod) {
      return mod && mod.__esModule ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.__initializeContext = __initializeContext;
    exports.isPoint = isPoint;
    exports.isPointCompressed = isPointCompressed;
    exports.isXOnlyPoint = isXOnlyPoint;
    exports.isPrivate = isPrivate;
    exports.pointAdd = pointAdd;
    exports.pointAddScalar = pointAddScalar;
    exports.pointCompress = pointCompress;
    exports.pointFromScalar = pointFromScalar;
    exports.xOnlyPointFromScalar = xOnlyPointFromScalar;
    exports.xOnlyPointFromPoint = xOnlyPointFromPoint;
    exports.pointMultiply = pointMultiply;
    exports.privateAdd = privateAdd;
    exports.privateSub = privateSub;
    exports.privateNegate = privateNegate;
    exports.xOnlyPointAddTweak = xOnlyPointAddTweak;
    exports.xOnlyPointAddTweakCheck = xOnlyPointAddTweakCheck;
    exports.sign = sign;
    exports.signRecoverable = signRecoverable;
    exports.signSchnorr = signSchnorr;
    exports.verify = verify;
    exports.recover = recover;
    exports.verifySchnorr = verifySchnorr;
    var validate = __importStar(require_validate());
    var wasm_js_1 = __importDefault(require_wasm());
    var validate_error = __importStar(require_validate_error());
    var rand = __importStar(require_rand());
    var memory_js_1 = __importDefault(require_memory());
    var imports = {
      "./rand.js": rand,
      "./validate_error.js": validate_error
    };
    var wasm = {};
    var memory = {};
    try {
      wasm = new WebAssembly.Instance(new WebAssembly.Module(wasm_js_1.default), imports).exports;
      memory = new memory_js_1.default(wasm);
    } catch (_) {
      WebAssembly.compile(wasm_js_1.default).then((wasmModule) => WebAssembly.instantiate(wasmModule, imports).then((instance) => {
        wasm = instance.exports;
        memory = new memory_js_1.default(wasm);
      }));
    }
    function assumeCompression(compressed, p) {
      if (compressed === void 0) {
        return p !== void 0 ? p.length : validate.PUBLIC_KEY_COMPRESSED_SIZE;
      }
      return compressed ? validate.PUBLIC_KEY_COMPRESSED_SIZE : validate.PUBLIC_KEY_UNCOMPRESSED_SIZE;
    }
    function _isPoint(p) {
      try {
        memory.PUBLIC_KEY_INPUT.set(p);
        return wasm.isPoint(p.length) === 1;
      } finally {
        memory.PUBLIC_KEY_INPUT.fill(0);
      }
    }
    function __initializeContext() {
      wasm.initializeContext();
    }
    function isPoint(p) {
      return validate.isDERPoint(p) && _isPoint(p);
    }
    function isPointCompressed(p) {
      return validate.isPointCompressed(p) && _isPoint(p);
    }
    function isXOnlyPoint(p) {
      return validate.isXOnlyPoint(p) && _isPoint(p);
    }
    function isPrivate(d) {
      return validate.isPrivate(d);
    }
    function pointAdd(pA, pB, compressed) {
      validate.validatePoint(pA);
      validate.validatePoint(pB);
      const outputlen = assumeCompression(compressed, pA);
      try {
        memory.PUBLIC_KEY_INPUT.set(pA);
        memory.PUBLIC_KEY_INPUT2.set(pB);
        return wasm.pointAdd(pA.length, pB.length, outputlen) === 1 ? memory.PUBLIC_KEY_INPUT.slice(0, outputlen) : null;
      } finally {
        memory.PUBLIC_KEY_INPUT.fill(0);
        memory.PUBLIC_KEY_INPUT2.fill(0);
      }
    }
    function pointAddScalar(p, tweak, compressed) {
      validate.validatePoint(p);
      validate.validateTweak(tweak);
      const outputlen = assumeCompression(compressed, p);
      try {
        memory.PUBLIC_KEY_INPUT.set(p);
        memory.TWEAK_INPUT.set(tweak);
        return wasm.pointAddScalar(p.length, outputlen) === 1 ? memory.PUBLIC_KEY_INPUT.slice(0, outputlen) : null;
      } finally {
        memory.PUBLIC_KEY_INPUT.fill(0);
        memory.TWEAK_INPUT.fill(0);
      }
    }
    function pointCompress(p, compressed) {
      validate.validatePoint(p);
      const outputlen = assumeCompression(compressed, p);
      try {
        memory.PUBLIC_KEY_INPUT.set(p);
        wasm.pointCompress(p.length, outputlen);
        return memory.PUBLIC_KEY_INPUT.slice(0, outputlen);
      } finally {
        memory.PUBLIC_KEY_INPUT.fill(0);
      }
    }
    function pointFromScalar(d, compressed) {
      validate.validatePrivate(d);
      const outputlen = assumeCompression(compressed);
      try {
        memory.PRIVATE_KEY_INPUT.set(d);
        return wasm.pointFromScalar(outputlen) === 1 ? memory.PUBLIC_KEY_INPUT.slice(0, outputlen) : null;
      } finally {
        memory.PRIVATE_KEY_INPUT.fill(0);
        memory.PUBLIC_KEY_INPUT.fill(0);
      }
    }
    function xOnlyPointFromScalar(d) {
      validate.validatePrivate(d);
      try {
        memory.PRIVATE_KEY_INPUT.set(d);
        wasm.xOnlyPointFromScalar();
        return memory.X_ONLY_PUBLIC_KEY_INPUT.slice(0, validate.X_ONLY_PUBLIC_KEY_SIZE);
      } finally {
        memory.PRIVATE_KEY_INPUT.fill(0);
        memory.X_ONLY_PUBLIC_KEY_INPUT.fill(0);
      }
    }
    function xOnlyPointFromPoint(p) {
      validate.validatePoint(p);
      try {
        memory.PUBLIC_KEY_INPUT.set(p);
        wasm.xOnlyPointFromPoint(p.length);
        return memory.X_ONLY_PUBLIC_KEY_INPUT.slice(0, validate.X_ONLY_PUBLIC_KEY_SIZE);
      } finally {
        memory.PUBLIC_KEY_INPUT.fill(0);
        memory.X_ONLY_PUBLIC_KEY_INPUT.fill(0);
      }
    }
    function pointMultiply(p, tweak, compressed) {
      validate.validatePoint(p);
      validate.validateTweak(tweak);
      const outputlen = assumeCompression(compressed, p);
      try {
        memory.PUBLIC_KEY_INPUT.set(p);
        memory.TWEAK_INPUT.set(tweak);
        return wasm.pointMultiply(p.length, outputlen) === 1 ? memory.PUBLIC_KEY_INPUT.slice(0, outputlen) : null;
      } finally {
        memory.PUBLIC_KEY_INPUT.fill(0);
        memory.TWEAK_INPUT.fill(0);
      }
    }
    function privateAdd(d, tweak) {
      validate.validatePrivate(d);
      validate.validateTweak(tweak);
      try {
        memory.PRIVATE_KEY_INPUT.set(d);
        memory.TWEAK_INPUT.set(tweak);
        return wasm.privateAdd() === 1 ? memory.PRIVATE_KEY_INPUT.slice(0, validate.PRIVATE_KEY_SIZE) : null;
      } finally {
        memory.PRIVATE_KEY_INPUT.fill(0);
        memory.TWEAK_INPUT.fill(0);
      }
    }
    function privateSub(d, tweak) {
      validate.validatePrivate(d);
      validate.validateTweak(tweak);
      if (validate.isZero(tweak)) {
        return new Uint8Array(d);
      }
      try {
        memory.PRIVATE_KEY_INPUT.set(d);
        memory.TWEAK_INPUT.set(tweak);
        return wasm.privateSub() === 1 ? memory.PRIVATE_KEY_INPUT.slice(0, validate.PRIVATE_KEY_SIZE) : null;
      } finally {
        memory.PRIVATE_KEY_INPUT.fill(0);
        memory.TWEAK_INPUT.fill(0);
      }
    }
    function privateNegate(d) {
      validate.validatePrivate(d);
      try {
        memory.PRIVATE_KEY_INPUT.set(d);
        wasm.privateNegate();
        return memory.PRIVATE_KEY_INPUT.slice(0, validate.PRIVATE_KEY_SIZE);
      } finally {
        memory.PRIVATE_KEY_INPUT.fill(0);
      }
    }
    function xOnlyPointAddTweak(p, tweak) {
      validate.validateXOnlyPoint(p);
      validate.validateTweak(tweak);
      try {
        memory.X_ONLY_PUBLIC_KEY_INPUT.set(p);
        memory.TWEAK_INPUT.set(tweak);
        const parity = wasm.xOnlyPointAddTweak();
        return parity !== -1 ? {
          parity,
          xOnlyPubkey: memory.X_ONLY_PUBLIC_KEY_INPUT.slice(0, validate.X_ONLY_PUBLIC_KEY_SIZE)
        } : null;
      } finally {
        memory.X_ONLY_PUBLIC_KEY_INPUT.fill(0);
        memory.TWEAK_INPUT.fill(0);
      }
    }
    function xOnlyPointAddTweakCheck(point, tweak, resultToCheck, tweakParity) {
      validate.validateXOnlyPoint(point);
      validate.validateXOnlyPoint(resultToCheck);
      validate.validateTweak(tweak);
      const hasParity = tweakParity !== void 0;
      if (hasParity)
        validate.validateParity(tweakParity);
      try {
        memory.X_ONLY_PUBLIC_KEY_INPUT.set(point);
        memory.X_ONLY_PUBLIC_KEY_INPUT2.set(resultToCheck);
        memory.TWEAK_INPUT.set(tweak);
        if (hasParity) {
          return wasm.xOnlyPointAddTweakCheck(tweakParity) === 1;
        } else {
          wasm.xOnlyPointAddTweak();
          const newKey = memory.X_ONLY_PUBLIC_KEY_INPUT.slice(0, validate.X_ONLY_PUBLIC_KEY_SIZE);
          return indexedDB.cmp(newKey, resultToCheck) === 0;
        }
      } finally {
        memory.X_ONLY_PUBLIC_KEY_INPUT.fill(0);
        memory.X_ONLY_PUBLIC_KEY_INPUT2.fill(0);
        memory.TWEAK_INPUT.fill(0);
      }
    }
    function sign(h, d, e) {
      validate.validateHash(h);
      validate.validatePrivate(d);
      validate.validateExtraData(e);
      try {
        memory.HASH_INPUT.set(h);
        memory.PRIVATE_KEY_INPUT.set(d);
        if (e !== void 0)
          memory.EXTRA_DATA_INPUT.set(e);
        wasm.sign(e === void 0 ? 0 : 1);
        return memory.SIGNATURE_INPUT.slice(0, validate.SIGNATURE_SIZE);
      } finally {
        memory.HASH_INPUT.fill(0);
        memory.PRIVATE_KEY_INPUT.fill(0);
        if (e !== void 0)
          memory.EXTRA_DATA_INPUT.fill(0);
        memory.SIGNATURE_INPUT.fill(0);
      }
    }
    function signRecoverable(h, d, e) {
      validate.validateHash(h);
      validate.validatePrivate(d);
      validate.validateExtraData(e);
      try {
        memory.HASH_INPUT.set(h);
        memory.PRIVATE_KEY_INPUT.set(d);
        if (e !== void 0)
          memory.EXTRA_DATA_INPUT.set(e);
        const recoveryId = wasm.signRecoverable(e === void 0 ? 0 : 1);
        const signature = memory.SIGNATURE_INPUT.slice(0, validate.SIGNATURE_SIZE);
        return {
          signature,
          recoveryId
        };
      } finally {
        memory.HASH_INPUT.fill(0);
        memory.PRIVATE_KEY_INPUT.fill(0);
        if (e !== void 0)
          memory.EXTRA_DATA_INPUT.fill(0);
        memory.SIGNATURE_INPUT.fill(0);
      }
    }
    function signSchnorr(h, d, e) {
      validate.validateHash(h);
      validate.validatePrivate(d);
      validate.validateExtraData(e);
      try {
        memory.HASH_INPUT.set(h);
        memory.PRIVATE_KEY_INPUT.set(d);
        if (e !== void 0)
          memory.EXTRA_DATA_INPUT.set(e);
        wasm.signSchnorr(e === void 0 ? 0 : 1);
        return memory.SIGNATURE_INPUT.slice(0, validate.SIGNATURE_SIZE);
      } finally {
        memory.HASH_INPUT.fill(0);
        memory.PRIVATE_KEY_INPUT.fill(0);
        if (e !== void 0)
          memory.EXTRA_DATA_INPUT.fill(0);
        memory.SIGNATURE_INPUT.fill(0);
      }
    }
    function verify(h, Q, signature, strict = false) {
      validate.validateHash(h);
      validate.validatePoint(Q);
      validate.validateSignature(signature);
      try {
        memory.HASH_INPUT.set(h);
        memory.PUBLIC_KEY_INPUT.set(Q);
        memory.SIGNATURE_INPUT.set(signature);
        return wasm.verify(Q.length, strict === true ? 1 : 0) === 1 ? true : false;
      } finally {
        memory.HASH_INPUT.fill(0);
        memory.PUBLIC_KEY_INPUT.fill(0);
        memory.SIGNATURE_INPUT.fill(0);
      }
    }
    function recover(h, signature, recoveryId, compressed = false) {
      validate.validateHash(h);
      validate.validateSignature(signature);
      validate.validateSignatureNonzeroRS(signature);
      if (recoveryId & 2) {
        validate.validateSigrPMinusN(signature);
      }
      validate.validateSignatureCustom(() => isXOnlyPoint(signature.subarray(0, 32)));
      const outputlen = assumeCompression(compressed);
      try {
        memory.HASH_INPUT.set(h);
        memory.SIGNATURE_INPUT.set(signature);
        return wasm.recover(outputlen, recoveryId) === 1 ? memory.PUBLIC_KEY_INPUT.slice(0, outputlen) : null;
      } finally {
        memory.HASH_INPUT.fill(0);
        memory.SIGNATURE_INPUT.fill(0);
        memory.PUBLIC_KEY_INPUT.fill(0);
      }
    }
    function verifySchnorr(h, Q, signature) {
      validate.validateHash(h);
      validate.validateXOnlyPoint(Q);
      validate.validateSignature(signature);
      try {
        memory.HASH_INPUT.set(h);
        memory.X_ONLY_PUBLIC_KEY_INPUT.set(Q);
        memory.SIGNATURE_INPUT.set(signature);
        return wasm.verifySchnorr() === 1 ? true : false;
      } finally {
        memory.HASH_INPUT.fill(0);
        memory.X_ONLY_PUBLIC_KEY_INPUT.fill(0);
        memory.SIGNATURE_INPUT.fill(0);
      }
    }
  }
});

// node_modules/belcoinjs-lib/src/payments/bip341.js
var require_bip341 = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/bip341.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.tweakKey = exports.tapTweakHash = exports.tapleafHash = exports.findScriptPath = exports.toHashTree = exports.rootHashFromPath = exports.MAX_TAPTREE_DEPTH = exports.LEAF_VERSION_TAPSCRIPT = void 0;
    var buffer_1 = require_buffer();
    var bcrypto = require_crypto2();
    var bufferutils_1 = require_bufferutils();
    var types_1 = require_types();
    var bells_secp256k1_1 = require_lib();
    exports.LEAF_VERSION_TAPSCRIPT = 192;
    exports.MAX_TAPTREE_DEPTH = 128;
    var isHashBranch = (ht) => "left" in ht && "right" in ht;
    function rootHashFromPath(controlBlock, leafHash) {
      if (controlBlock.length < 33)
        throw new TypeError(
          `The control-block length is too small. Got ${controlBlock.length}, expected min 33.`
        );
      const m = (controlBlock.length - 33) / 32;
      let kj = leafHash;
      for (let j = 0; j < m; j++) {
        const ej = controlBlock.slice(33 + 32 * j, 65 + 32 * j);
        if (kj.compare(ej) < 0) {
          kj = tapBranchHash(kj, ej);
        } else {
          kj = tapBranchHash(ej, kj);
        }
      }
      return kj;
    }
    exports.rootHashFromPath = rootHashFromPath;
    function toHashTree(scriptTree) {
      if ((0, types_1.isTapleaf)(scriptTree))
        return { hash: tapleafHash(scriptTree) };
      const hashes = [toHashTree(scriptTree[0]), toHashTree(scriptTree[1])];
      hashes.sort((a, b) => a.hash.compare(b.hash));
      const [left, right] = hashes;
      return {
        hash: tapBranchHash(left.hash, right.hash),
        left,
        right
      };
    }
    exports.toHashTree = toHashTree;
    function findScriptPath(node, hash) {
      if (isHashBranch(node)) {
        const leftPath = findScriptPath(node.left, hash);
        if (leftPath !== void 0) return [...leftPath, node.right.hash];
        const rightPath = findScriptPath(node.right, hash);
        if (rightPath !== void 0) return [...rightPath, node.left.hash];
      } else if (node.hash.equals(hash)) {
        return [];
      }
      return void 0;
    }
    exports.findScriptPath = findScriptPath;
    function tapleafHash(leaf) {
      const version = leaf.version || exports.LEAF_VERSION_TAPSCRIPT;
      return bcrypto.taggedHash(
        "TapLeaf",
        buffer_1.Buffer.concat([
          buffer_1.Buffer.from([version]),
          serializeScript(leaf.output)
        ])
      );
    }
    exports.tapleafHash = tapleafHash;
    function tapTweakHash(pubKey, h) {
      return bcrypto.taggedHash(
        "TapTweak",
        buffer_1.Buffer.concat(h ? [pubKey, h] : [pubKey])
      );
    }
    exports.tapTweakHash = tapTweakHash;
    function tweakKey(pubKey, h) {
      if (!buffer_1.Buffer.isBuffer(pubKey)) return null;
      if (pubKey.length !== 32) return null;
      if (h && h.length !== 32) return null;
      const tweakHash = tapTweakHash(pubKey, h);
      const res = (0, bells_secp256k1_1.xOnlyPointAddTweak)(pubKey, tweakHash);
      if (!res || res.xOnlyPubkey === null) return null;
      return {
        parity: res.parity,
        x: buffer_1.Buffer.from(res.xOnlyPubkey)
      };
    }
    exports.tweakKey = tweakKey;
    function tapBranchHash(a, b) {
      return bcrypto.taggedHash("TapBranch", buffer_1.Buffer.concat([a, b]));
    }
    function serializeScript(s) {
      const varintLen = bufferutils_1.varuint.encodingLength(s.length);
      const buffer = buffer_1.Buffer.allocUnsafe(varintLen);
      bufferutils_1.varuint.encode(s.length, buffer);
      return buffer_1.Buffer.concat([buffer, s]);
    }
  }
});

// node_modules/belcoinjs-lib/src/payments/p2tr.js
var require_p2tr = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/p2tr.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2tr = void 0;
    var buffer_1 = require_buffer();
    var networks_1 = require_networks();
    var bscript2 = require_script();
    var types_1 = require_types();
    var bip341_1 = require_bip341();
    var lazy = require_lazy();
    var bech32_1 = require_dist();
    var address_1 = require_address();
    var bells_secp256k1_1 = require_lib();
    var OPS = bscript2.OPS;
    var TAPROOT_WITNESS_VERSION = 1;
    var ANNEX_PREFIX = 80;
    function p2tr(a, opts) {
      if (!a.address && !a.output && !a.pubkey && !a.internalPubkey && !(a.witness && a.witness.length > 1))
        throw new TypeError("Not enough data");
      opts = Object.assign({ validate: true }, opts || {});
      (0, types_1.typeforce)(
        {
          address: types_1.typeforce.maybe(types_1.typeforce.String),
          input: types_1.typeforce.maybe(types_1.typeforce.BufferN(0)),
          network: types_1.typeforce.maybe(types_1.typeforce.Object),
          output: types_1.typeforce.maybe(types_1.typeforce.BufferN(34)),
          internalPubkey: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
          hash: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
          pubkey: types_1.typeforce.maybe(types_1.typeforce.BufferN(32)),
          signature: types_1.typeforce.maybe(
            types_1.typeforce.anyOf(
              types_1.typeforce.BufferN(64),
              types_1.typeforce.BufferN(65)
            )
          ),
          witness: types_1.typeforce.maybe(
            types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
          ),
          scriptTree: types_1.typeforce.maybe(types_1.isTaptree),
          redeem: types_1.typeforce.maybe({
            output: types_1.typeforce.maybe(types_1.typeforce.Buffer),
            redeemVersion: types_1.typeforce.maybe(types_1.typeforce.Number),
            witness: types_1.typeforce.maybe(
              types_1.typeforce.arrayOf(types_1.typeforce.Buffer)
            )
          }),
          redeemVersion: types_1.typeforce.maybe(types_1.typeforce.Number)
        },
        a
      );
      const _address = lazy.value(() => {
        return (0, address_1.fromBech32)(a.address);
      });
      const _witness = lazy.value(() => {
        if (!a.witness || !a.witness.length) return;
        if (a.witness.length >= 2 && a.witness[a.witness.length - 1][0] === ANNEX_PREFIX) {
          return a.witness.slice(0, -1);
        }
        return a.witness.slice();
      });
      const _hashTree = lazy.value(() => {
        if (a.scriptTree) return (0, bip341_1.toHashTree)(a.scriptTree);
        if (a.hash) return { hash: a.hash };
        return;
      });
      const network = a.network || networks_1.bellcoin;
      const o = { name: "p2tr", network };
      lazy.prop(o, "address", () => {
        if (!o.pubkey) return;
        const words = bech32_1.bech32m.toWords(o.pubkey);
        words.unshift(TAPROOT_WITNESS_VERSION);
        return bech32_1.bech32m.encode(network.bech32, words);
      });
      lazy.prop(o, "hash", () => {
        const hashTree = _hashTree();
        if (hashTree) return hashTree.hash;
        const w = _witness();
        if (w && w.length > 1) {
          const controlBlock = w[w.length - 1];
          const leafVersion = controlBlock[0] & types_1.TAPLEAF_VERSION_MASK;
          const script = w[w.length - 2];
          const leafHash = (0, bip341_1.tapleafHash)({
            output: script,
            version: leafVersion
          });
          return (0, bip341_1.rootHashFromPath)(controlBlock, leafHash);
        }
        return null;
      });
      lazy.prop(o, "output", () => {
        if (!o.pubkey) return;
        return bscript2.compile([OPS.OP_1, o.pubkey]);
      });
      lazy.prop(o, "redeemVersion", () => {
        if (a.redeemVersion) return a.redeemVersion;
        if (a.redeem && a.redeem.redeemVersion !== void 0 && a.redeem.redeemVersion !== null) {
          return a.redeem.redeemVersion;
        }
        return bip341_1.LEAF_VERSION_TAPSCRIPT;
      });
      lazy.prop(o, "redeem", () => {
        const witness = _witness();
        if (!witness || witness.length < 2) return;
        return {
          output: witness[witness.length - 2],
          witness: witness.slice(0, -2),
          redeemVersion: witness[witness.length - 1][0] & types_1.TAPLEAF_VERSION_MASK
        };
      });
      lazy.prop(o, "pubkey", () => {
        if (a.pubkey) return a.pubkey;
        if (a.output) return a.output.slice(2);
        if (a.address) return _address().data;
        if (o.internalPubkey) {
          const tweakedKey = (0, bip341_1.tweakKey)(o.internalPubkey, o.hash);
          if (tweakedKey) return tweakedKey.x;
        }
      });
      lazy.prop(o, "internalPubkey", () => {
        if (a.internalPubkey) return a.internalPubkey;
        const witness = _witness();
        if (witness && witness.length > 1)
          return witness[witness.length - 1].slice(1, 33);
      });
      lazy.prop(o, "signature", () => {
        if (a.signature) return a.signature;
        const witness = _witness();
        if (!witness || witness.length !== 1) return;
        return witness[0];
      });
      lazy.prop(o, "witness", () => {
        if (a.witness) return a.witness;
        const hashTree = _hashTree();
        if (hashTree && a.redeem && a.redeem.output && a.internalPubkey) {
          const leafHash = (0, bip341_1.tapleafHash)({
            output: a.redeem.output,
            version: o.redeemVersion
          });
          const path = (0, bip341_1.findScriptPath)(hashTree, leafHash);
          if (!path) return;
          const outputKey = (0, bip341_1.tweakKey)(a.internalPubkey, hashTree.hash);
          if (!outputKey) return;
          const controlBock = buffer_1.Buffer.concat(
            [
              buffer_1.Buffer.from([o.redeemVersion | outputKey.parity]),
              a.internalPubkey
            ].concat(path)
          );
          return [a.redeem.output, controlBock];
        }
        if (a.signature) return [a.signature];
      });
      if (opts.validate) {
        let pubkey = buffer_1.Buffer.from([]);
        if (a.address) {
          if (network && network.bech32 !== _address().prefix)
            throw new TypeError("Invalid prefix or Network mismatch");
          if (_address().version !== TAPROOT_WITNESS_VERSION)
            throw new TypeError("Invalid address version");
          if (_address().data.length !== 32)
            throw new TypeError("Invalid address data");
          pubkey = _address().data;
        }
        if (a.pubkey) {
          if (pubkey.length > 0 && !pubkey.equals(a.pubkey))
            throw new TypeError("Pubkey mismatch");
          else pubkey = a.pubkey;
        }
        if (a.output) {
          if (a.output.length !== 34 || a.output[0] !== OPS.OP_1 || a.output[1] !== 32)
            throw new TypeError("Output is invalid");
          if (pubkey.length > 0 && !pubkey.equals(a.output.slice(2)))
            throw new TypeError("Pubkey mismatch");
          else pubkey = a.output.slice(2);
        }
        if (a.internalPubkey) {
          const tweakedKey = (0, bip341_1.tweakKey)(a.internalPubkey, o.hash);
          if (pubkey.length > 0 && !pubkey.equals(tweakedKey.x))
            throw new TypeError("Pubkey mismatch");
          else pubkey = tweakedKey.x;
        }
        if (pubkey && pubkey.length) {
          if (!(0, bells_secp256k1_1.isXOnlyPoint)(pubkey))
            throw new TypeError("Invalid pubkey for p2tr");
        }
        const hashTree = _hashTree();
        if (a.hash && hashTree) {
          if (!a.hash.equals(hashTree.hash)) throw new TypeError("Hash mismatch");
        }
        if (a.redeem && a.redeem.output && hashTree) {
          const leafHash = (0, bip341_1.tapleafHash)({
            output: a.redeem.output,
            version: o.redeemVersion
          });
          if (!(0, bip341_1.findScriptPath)(hashTree, leafHash))
            throw new TypeError("Redeem script not in tree");
        }
        const witness = _witness();
        if (a.redeem && o.redeem) {
          if (a.redeem.redeemVersion) {
            if (a.redeem.redeemVersion !== o.redeem.redeemVersion)
              throw new TypeError("Redeem.redeemVersion and witness mismatch");
          }
          if (a.redeem.output) {
            if (bscript2.decompile(a.redeem.output).length === 0)
              throw new TypeError("Redeem.output is invalid");
            if (o.redeem.output && !a.redeem.output.equals(o.redeem.output))
              throw new TypeError("Redeem.output and witness mismatch");
          }
          if (a.redeem.witness) {
            if (o.redeem.witness && !(0, types_1.stacksEqual)(a.redeem.witness, o.redeem.witness))
              throw new TypeError("Redeem.witness and witness mismatch");
          }
        }
        if (witness && witness.length) {
          if (witness.length === 1) {
            if (a.signature && !a.signature.equals(witness[0]))
              throw new TypeError("Signature mismatch");
          } else {
            const controlBlock = witness[witness.length - 1];
            if (controlBlock.length < 33)
              throw new TypeError(
                `The control-block length is too small. Got ${controlBlock.length}, expected min 33.`
              );
            if ((controlBlock.length - 33) % 32 !== 0)
              throw new TypeError(
                `The control-block length of ${controlBlock.length} is incorrect!`
              );
            const m = (controlBlock.length - 33) / 32;
            if (m > 128)
              throw new TypeError(
                `The script path is too long. Got ${m}, expected max 128.`
              );
            const internalPubkey = controlBlock.slice(1, 33);
            if (a.internalPubkey && !a.internalPubkey.equals(internalPubkey))
              throw new TypeError("Internal pubkey mismatch");
            if (!(0, bells_secp256k1_1.isXOnlyPoint)(internalPubkey))
              throw new TypeError("Invalid internalPubkey for p2tr witness");
            const leafVersion = controlBlock[0] & types_1.TAPLEAF_VERSION_MASK;
            const script = witness[witness.length - 2];
            const leafHash = (0, bip341_1.tapleafHash)({
              output: script,
              version: leafVersion
            });
            const hash = (0, bip341_1.rootHashFromPath)(controlBlock, leafHash);
            const outputKey = (0, bip341_1.tweakKey)(internalPubkey, hash);
            if (!outputKey)
              throw new TypeError("Invalid outputKey for p2tr witness");
            if (pubkey.length && !pubkey.equals(outputKey.x))
              throw new TypeError("Pubkey mismatch for p2tr witness");
            if (outputKey.parity !== (controlBlock[0] & 1))
              throw new Error("Incorrect parity");
          }
        }
      }
      return Object.assign(o, a);
    }
    exports.p2tr = p2tr;
  }
});

// node_modules/belcoinjs-lib/src/payments/index.js
var require_payments = __commonJS({
  "node_modules/belcoinjs-lib/src/payments/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.p2tr = exports.p2wsh = exports.p2wpkh = exports.p2sh = exports.p2pkh = exports.p2pk = exports.p2ms = exports.embed = void 0;
    var embed_1 = require_embed();
    Object.defineProperty(exports, "embed", {
      enumerable: true,
      get: function() {
        return embed_1.p2data;
      }
    });
    var p2ms_1 = require_p2ms();
    Object.defineProperty(exports, "p2ms", {
      enumerable: true,
      get: function() {
        return p2ms_1.p2ms;
      }
    });
    var p2pk_1 = require_p2pk();
    Object.defineProperty(exports, "p2pk", {
      enumerable: true,
      get: function() {
        return p2pk_1.p2pk;
      }
    });
    var p2pkh_1 = require_p2pkh();
    Object.defineProperty(exports, "p2pkh", {
      enumerable: true,
      get: function() {
        return p2pkh_1.p2pkh;
      }
    });
    var p2sh_1 = require_p2sh();
    Object.defineProperty(exports, "p2sh", {
      enumerable: true,
      get: function() {
        return p2sh_1.p2sh;
      }
    });
    var p2wpkh_1 = require_p2wpkh();
    Object.defineProperty(exports, "p2wpkh", {
      enumerable: true,
      get: function() {
        return p2wpkh_1.p2wpkh;
      }
    });
    var p2wsh_1 = require_p2wsh();
    Object.defineProperty(exports, "p2wsh", {
      enumerable: true,
      get: function() {
        return p2wsh_1.p2wsh;
      }
    });
    var p2tr_1 = require_p2tr();
    Object.defineProperty(exports, "p2tr", {
      enumerable: true,
      get: function() {
        return p2tr_1.p2tr;
      }
    });
  }
});

// node_modules/belcoinjs-lib/src/address.js
var require_address = __commonJS({
  "node_modules/belcoinjs-lib/src/address.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.toOutputScript = exports.fromOutputScript = exports.toBech32 = exports.toBase58Check = exports.fromBech32 = exports.fromBase58Check = void 0;
    var networks2 = require_networks();
    var payments3 = require_payments();
    var bscript2 = require_script();
    var types_1 = require_types();
    var bech32_1 = require_dist();
    var bs58check = require_bs58check();
    var FUTURE_SEGWIT_MAX_SIZE = 40;
    var FUTURE_SEGWIT_MIN_SIZE = 2;
    var FUTURE_SEGWIT_MAX_VERSION = 16;
    var FUTURE_SEGWIT_MIN_VERSION = 2;
    var FUTURE_SEGWIT_VERSION_DIFF = 80;
    var FUTURE_SEGWIT_VERSION_WARNING = "WARNING: Sending to a future segwit version address can lead to loss of funds. End users MUST be warned carefully in the GUI and asked if they wish to proceed with caution. Wallets should verify the segwit version from the output of fromBech32, then decide when it is safe to use which version of segwit.";
    function _toFutureSegwitAddress(output, network) {
      const data = output.slice(2);
      if (data.length < FUTURE_SEGWIT_MIN_SIZE || data.length > FUTURE_SEGWIT_MAX_SIZE)
        throw new TypeError("Invalid program length for segwit address");
      const version = output[0] - FUTURE_SEGWIT_VERSION_DIFF;
      if (version < FUTURE_SEGWIT_MIN_VERSION || version > FUTURE_SEGWIT_MAX_VERSION)
        throw new TypeError("Invalid version for segwit address");
      if (output[1] !== data.length)
        throw new TypeError("Invalid script for segwit address");
      console.warn(FUTURE_SEGWIT_VERSION_WARNING);
      return toBech32(data, version, network.bech32);
    }
    function fromBase58Check(address2) {
      const payload = Buffer2.from(bs58check.decode(address2));
      if (payload.length < 21) throw new TypeError(address2 + " is too short");
      if (payload.length > 21) throw new TypeError(address2 + " is too long");
      const version = payload.readUInt8(0);
      const hash = payload.slice(1);
      return { version, hash };
    }
    exports.fromBase58Check = fromBase58Check;
    function fromBech32(address2) {
      let result;
      let version;
      try {
        result = bech32_1.bech32.decode(address2);
      } catch (e) {
      }
      if (result) {
        version = result.words[0];
        if (version !== 0) throw new TypeError(address2 + " uses wrong encoding");
      } else {
        result = bech32_1.bech32m.decode(address2);
        version = result.words[0];
        if (version === 0) throw new TypeError(address2 + " uses wrong encoding");
      }
      const data = bech32_1.bech32.fromWords(result.words.slice(1));
      return {
        version,
        prefix: result.prefix,
        data: Buffer2.from(data)
      };
    }
    exports.fromBech32 = fromBech32;
    function toBase58Check(hash, version) {
      (0, types_1.typeforce)(
        (0, types_1.tuple)(types_1.Hash160bit, types_1.UInt8),
        arguments
      );
      const payload = Buffer2.allocUnsafe(21);
      payload.writeUInt8(version, 0);
      hash.copy(payload, 1);
      return bs58check.encode(payload);
    }
    exports.toBase58Check = toBase58Check;
    function toBech32(data, version, prefix) {
      const words = bech32_1.bech32.toWords(data);
      words.unshift(version);
      return version === 0 ? bech32_1.bech32.encode(prefix, words) : bech32_1.bech32m.encode(prefix, words);
    }
    exports.toBech32 = toBech32;
    function fromOutputScript(output, network) {
      network = network || networks2.bellcoin;
      try {
        return payments3.p2pkh({ output, network }).address;
      } catch (e) {
      }
      try {
        return payments3.p2sh({ output, network }).address;
      } catch (e) {
      }
      try {
        return payments3.p2wpkh({ output, network }).address;
      } catch (e) {
      }
      try {
        return payments3.p2wsh({ output, network }).address;
      } catch (e) {
      }
      try {
        return payments3.p2tr({ output, network }).address;
      } catch (e) {
      }
      try {
        return _toFutureSegwitAddress(output, network);
      } catch (e) {
      }
      throw new Error(bscript2.toASM(output) + " has no matching Address");
    }
    exports.fromOutputScript = fromOutputScript;
    function toOutputScript(address2, network) {
      network = network || networks2.bellcoin;
      let decodeBase58;
      let decodeBech32;
      try {
        decodeBase58 = fromBase58Check(address2);
      } catch (e) {
      }
      if (decodeBase58) {
        if (decodeBase58.version === network.pubKeyHash)
          return payments3.p2pkh({ hash: decodeBase58.hash }).output;
        if (decodeBase58.version === network.scriptHash)
          return payments3.p2sh({ hash: decodeBase58.hash }).output;
      } else {
        try {
          decodeBech32 = fromBech32(address2);
        } catch (e) {
        }
        if (decodeBech32) {
          if (decodeBech32.prefix !== network.bech32)
            throw new Error(address2 + " has an invalid prefix");
          if (decodeBech32.version === 0) {
            if (decodeBech32.data.length === 20)
              return payments3.p2wpkh({ hash: decodeBech32.data }).output;
            if (decodeBech32.data.length === 32)
              return payments3.p2wsh({ hash: decodeBech32.data }).output;
          } else if (decodeBech32.version === 1) {
            if (decodeBech32.data.length === 32)
              return payments3.p2tr({ pubkey: decodeBech32.data }).output;
          } else if (decodeBech32.version >= FUTURE_SEGWIT_MIN_VERSION && decodeBech32.version <= FUTURE_SEGWIT_MAX_VERSION && decodeBech32.data.length >= FUTURE_SEGWIT_MIN_SIZE && decodeBech32.data.length <= FUTURE_SEGWIT_MAX_SIZE) {
            console.warn(FUTURE_SEGWIT_VERSION_WARNING);
            return bscript2.compile([
              decodeBech32.version + FUTURE_SEGWIT_VERSION_DIFF,
              decodeBech32.data
            ]);
          }
        }
      }
      throw new Error(address2 + " has no matching Script");
    }
    exports.toOutputScript = toOutputScript;
  }
});

// node_modules/belcoinjs-lib/src/merkle.js
var require_merkle = __commonJS({
  "node_modules/belcoinjs-lib/src/merkle.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.fastMerkleRoot = void 0;
    function fastMerkleRoot(values, digestFn) {
      if (!Array.isArray(values)) throw TypeError("Expected values Array");
      if (typeof digestFn !== "function")
        throw TypeError("Expected digest Function");
      let length = values.length;
      const results = values.concat();
      while (length > 1) {
        let j = 0;
        for (let i = 0; i < length; i += 2, ++j) {
          const left = results[i];
          const right = i + 1 === length ? left : results[i + 1];
          const data = Buffer2.concat([left, right]);
          results[j] = digestFn(data);
        }
        length = j;
      }
      return results[0];
    }
    exports.fastMerkleRoot = fastMerkleRoot;
  }
});

// node_modules/belcoinjs-lib/src/transaction.js
var require_transaction = __commonJS({
  "node_modules/belcoinjs-lib/src/transaction.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Transaction = void 0;
    var bufferutils_1 = require_bufferutils();
    var bcrypto = require_crypto2();
    var bscript2 = require_script();
    var script_1 = require_script();
    var types = require_types();
    var { typeforce } = types;
    function varSliceSize(someScript) {
      const length = someScript.length;
      return bufferutils_1.varuint.encodingLength(length) + length;
    }
    function vectorSize(someVector) {
      const length = someVector.length;
      return bufferutils_1.varuint.encodingLength(length) + someVector.reduce((sum, witness) => {
        return sum + varSliceSize(witness);
      }, 0);
    }
    var EMPTY_BUFFER = Buffer2.allocUnsafe(0);
    var EMPTY_WITNESS = [];
    var ZERO = Buffer2.from(
      "0000000000000000000000000000000000000000000000000000000000000000",
      "hex"
    );
    var ONE = Buffer2.from(
      "0000000000000000000000000000000000000000000000000000000000000001",
      "hex"
    );
    var VALUE_UINT64_MAX = Buffer2.from("ffffffffffffffff", "hex");
    var BLANK_OUTPUT = {
      script: EMPTY_BUFFER,
      valueBuffer: VALUE_UINT64_MAX
    };
    function isOutput(out) {
      return out.value !== void 0;
    }
    var Transaction2 = class _Transaction {
      constructor() {
        this.version = 1;
        this.locktime = 0;
        this.ins = [];
        this.outs = [];
      }
      static fromBuffer(buffer, _NO_STRICT) {
        const bufferReader = new bufferutils_1.BufferReader(buffer);
        const tx = new _Transaction();
        tx.version = bufferReader.readInt32();
        const marker = bufferReader.readUInt8();
        const flag = bufferReader.readUInt8();
        let hasWitnesses = false;
        if (marker === _Transaction.ADVANCED_TRANSACTION_MARKER && flag === _Transaction.ADVANCED_TRANSACTION_FLAG) {
          hasWitnesses = true;
        } else {
          bufferReader.offset -= 2;
        }
        const vinLen = bufferReader.readVarInt();
        for (let i = 0; i < vinLen; ++i) {
          tx.ins.push({
            hash: bufferReader.readSlice(32),
            index: bufferReader.readUInt32(),
            script: bufferReader.readVarSlice(),
            sequence: bufferReader.readUInt32(),
            witness: EMPTY_WITNESS
          });
        }
        const voutLen = bufferReader.readVarInt();
        for (let i = 0; i < voutLen; ++i) {
          tx.outs.push({
            value: bufferReader.readUInt64(),
            script: bufferReader.readVarSlice()
          });
        }
        if (hasWitnesses) {
          for (let i = 0; i < vinLen; ++i) {
            tx.ins[i].witness = bufferReader.readVector();
          }
          if (!tx.hasWitnesses())
            throw new Error("Transaction has superfluous witness data");
        }
        tx.locktime = bufferReader.readUInt32();
        if (_NO_STRICT) return tx;
        if (bufferReader.offset !== buffer.length)
          throw new Error("Transaction has unexpected data");
        return tx;
      }
      static fromHex(hex) {
        return _Transaction.fromBuffer(Buffer2.from(hex, "hex"), false);
      }
      static isCoinbaseHash(buffer) {
        typeforce(types.Hash256bit, buffer);
        for (let i = 0; i < 32; ++i) {
          if (buffer[i] !== 0) return false;
        }
        return true;
      }
      isCoinbase() {
        return this.ins.length === 1 && _Transaction.isCoinbaseHash(this.ins[0].hash);
      }
      addInput(hash, index, sequence, scriptSig) {
        typeforce(
          types.tuple(
            types.Hash256bit,
            types.UInt32,
            types.maybe(types.UInt32),
            types.maybe(types.Buffer)
          ),
          arguments
        );
        if (types.Null(sequence)) {
          sequence = _Transaction.DEFAULT_SEQUENCE;
        }
        return this.ins.push({
          hash,
          index,
          script: scriptSig || EMPTY_BUFFER,
          sequence,
          witness: EMPTY_WITNESS
        }) - 1;
      }
      addOutput(scriptPubKey, value) {
        typeforce(types.tuple(types.Buffer, types.Satoshi), arguments);
        return this.outs.push({
          script: scriptPubKey,
          value
        }) - 1;
      }
      hasWitnesses() {
        return this.ins.some((x) => {
          return x.witness.length !== 0;
        });
      }
      weight() {
        const base = this.byteLength(false);
        const total = this.byteLength(true);
        return base * 3 + total;
      }
      virtualSize() {
        return Math.ceil(this.weight() / 4);
      }
      byteLength(_ALLOW_WITNESS = true) {
        const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();
        return (hasWitnesses ? 10 : 8) + bufferutils_1.varuint.encodingLength(this.ins.length) + bufferutils_1.varuint.encodingLength(this.outs.length) + this.ins.reduce((sum, input) => {
          return sum + 40 + varSliceSize(input.script);
        }, 0) + this.outs.reduce((sum, output) => {
          return sum + 8 + varSliceSize(output.script);
        }, 0) + (hasWitnesses ? this.ins.reduce((sum, input) => {
          return sum + vectorSize(input.witness);
        }, 0) : 0);
      }
      clone() {
        const newTx = new _Transaction();
        newTx.version = this.version;
        newTx.locktime = this.locktime;
        newTx.ins = this.ins.map((txIn) => {
          return {
            hash: txIn.hash,
            index: txIn.index,
            script: txIn.script,
            sequence: txIn.sequence,
            witness: txIn.witness
          };
        });
        newTx.outs = this.outs.map((txOut) => {
          return {
            script: txOut.script,
            value: txOut.value
          };
        });
        return newTx;
      }
      /**
       * Hash transaction for signing a specific input.
       *
       * Bitcoin uses a different hash for each signed transaction input.
       * This method copies the transaction, makes the necessary changes based on the
       * hashType, and then hashes the result.
       * This hash can then be used to sign the provided transaction input.
       */
      hashForSignature(inIndex, prevOutScript, hashType) {
        typeforce(
          types.tuple(
            types.UInt32,
            types.Buffer,
            /* types.UInt8 */
            types.Number
          ),
          arguments
        );
        if (inIndex >= this.ins.length) return ONE;
        const ourScript = bscript2.compile(
          bscript2.decompile(prevOutScript).filter((x) => {
            return x !== script_1.OPS.OP_CODESEPARATOR;
          })
        );
        const txTmp = this.clone();
        if ((hashType & 31) === _Transaction.SIGHASH_NONE) {
          txTmp.outs = [];
          txTmp.ins.forEach((input, i) => {
            if (i === inIndex) return;
            input.sequence = 0;
          });
        } else if ((hashType & 31) === _Transaction.SIGHASH_SINGLE) {
          if (inIndex >= this.outs.length) return ONE;
          txTmp.outs.length = inIndex + 1;
          for (let i = 0; i < inIndex; i++) {
            txTmp.outs[i] = BLANK_OUTPUT;
          }
          txTmp.ins.forEach((input, y) => {
            if (y === inIndex) return;
            input.sequence = 0;
          });
        }
        if (hashType & _Transaction.SIGHASH_ANYONECANPAY) {
          txTmp.ins = [txTmp.ins[inIndex]];
          txTmp.ins[0].script = ourScript;
        } else {
          txTmp.ins.forEach((input) => {
            input.script = EMPTY_BUFFER;
          });
          txTmp.ins[inIndex].script = ourScript;
        }
        const buffer = Buffer2.allocUnsafe(txTmp.byteLength(false) + 4);
        buffer.writeInt32LE(hashType, buffer.length - 4);
        txTmp.__toBuffer(buffer, 0, false);
        return bcrypto.hash256(buffer);
      }
      hashForWitnessV1(inIndex, prevOutScripts, values, hashType, leafHash, annex) {
        typeforce(
          types.tuple(
            types.UInt32,
            typeforce.arrayOf(types.Buffer),
            typeforce.arrayOf(types.Satoshi),
            types.UInt32
          ),
          arguments
        );
        if (values.length !== this.ins.length || prevOutScripts.length !== this.ins.length) {
          throw new Error("Must supply prevout script and value for all inputs");
        }
        const outputType = hashType === _Transaction.SIGHASH_DEFAULT ? _Transaction.SIGHASH_ALL : hashType & _Transaction.SIGHASH_OUTPUT_MASK;
        const inputType = hashType & _Transaction.SIGHASH_INPUT_MASK;
        const isAnyoneCanPay = inputType === _Transaction.SIGHASH_ANYONECANPAY;
        const isNone = outputType === _Transaction.SIGHASH_NONE;
        const isSingle = outputType === _Transaction.SIGHASH_SINGLE;
        let hashPrevouts = EMPTY_BUFFER;
        let hashAmounts = EMPTY_BUFFER;
        let hashScriptPubKeys = EMPTY_BUFFER;
        let hashSequences = EMPTY_BUFFER;
        let hashOutputs = EMPTY_BUFFER;
        if (!isAnyoneCanPay) {
          let bufferWriter = bufferutils_1.BufferWriter.withCapacity(
            36 * this.ins.length
          );
          this.ins.forEach((txIn) => {
            bufferWriter.writeSlice(txIn.hash);
            bufferWriter.writeUInt32(txIn.index);
          });
          hashPrevouts = bcrypto.sha256(bufferWriter.end());
          bufferWriter = bufferutils_1.BufferWriter.withCapacity(
            8 * this.ins.length
          );
          values.forEach((value) => bufferWriter.writeUInt64(value));
          hashAmounts = bcrypto.sha256(bufferWriter.end());
          bufferWriter = bufferutils_1.BufferWriter.withCapacity(
            prevOutScripts.map(varSliceSize).reduce((a, b) => a + b)
          );
          prevOutScripts.forEach(
            (prevOutScript) => bufferWriter.writeVarSlice(prevOutScript)
          );
          hashScriptPubKeys = bcrypto.sha256(bufferWriter.end());
          bufferWriter = bufferutils_1.BufferWriter.withCapacity(
            4 * this.ins.length
          );
          this.ins.forEach((txIn) => bufferWriter.writeUInt32(txIn.sequence));
          hashSequences = bcrypto.sha256(bufferWriter.end());
        }
        if (!(isNone || isSingle)) {
          if (!this.outs.length)
            throw new Error("Add outputs to the transaction before signing.");
          const txOutsSize = this.outs.map((output) => 8 + varSliceSize(output.script)).reduce((a, b) => a + b);
          const bufferWriter = bufferutils_1.BufferWriter.withCapacity(txOutsSize);
          this.outs.forEach((out) => {
            bufferWriter.writeUInt64(out.value);
            bufferWriter.writeVarSlice(out.script);
          });
          hashOutputs = bcrypto.sha256(bufferWriter.end());
        } else if (isSingle && inIndex < this.outs.length) {
          const output = this.outs[inIndex];
          const bufferWriter = bufferutils_1.BufferWriter.withCapacity(
            8 + varSliceSize(output.script)
          );
          bufferWriter.writeUInt64(output.value);
          bufferWriter.writeVarSlice(output.script);
          hashOutputs = bcrypto.sha256(bufferWriter.end());
        }
        const spendType = (leafHash ? 2 : 0) + (annex ? 1 : 0);
        const sigMsgSize = 174 - (isAnyoneCanPay ? 49 : 0) - (isNone ? 32 : 0) + (annex ? 32 : 0) + (leafHash ? 37 : 0);
        const sigMsgWriter = bufferutils_1.BufferWriter.withCapacity(sigMsgSize);
        sigMsgWriter.writeUInt8(hashType);
        sigMsgWriter.writeInt32(this.version);
        sigMsgWriter.writeUInt32(this.locktime);
        sigMsgWriter.writeSlice(hashPrevouts);
        sigMsgWriter.writeSlice(hashAmounts);
        sigMsgWriter.writeSlice(hashScriptPubKeys);
        sigMsgWriter.writeSlice(hashSequences);
        if (!(isNone || isSingle)) {
          sigMsgWriter.writeSlice(hashOutputs);
        }
        sigMsgWriter.writeUInt8(spendType);
        if (isAnyoneCanPay) {
          const input = this.ins[inIndex];
          sigMsgWriter.writeSlice(input.hash);
          sigMsgWriter.writeUInt32(input.index);
          sigMsgWriter.writeUInt64(values[inIndex]);
          sigMsgWriter.writeVarSlice(prevOutScripts[inIndex]);
          sigMsgWriter.writeUInt32(input.sequence);
        } else {
          sigMsgWriter.writeUInt32(inIndex);
        }
        if (annex) {
          const bufferWriter = bufferutils_1.BufferWriter.withCapacity(
            varSliceSize(annex)
          );
          bufferWriter.writeVarSlice(annex);
          sigMsgWriter.writeSlice(bcrypto.sha256(bufferWriter.end()));
        }
        if (isSingle) {
          sigMsgWriter.writeSlice(hashOutputs);
        }
        if (leafHash) {
          sigMsgWriter.writeSlice(leafHash);
          sigMsgWriter.writeUInt8(0);
          sigMsgWriter.writeUInt32(4294967295);
        }
        return bcrypto.taggedHash(
          "TapSighash",
          Buffer2.concat([Buffer2.from([0]), sigMsgWriter.end()])
        );
      }
      hashForWitnessV0(inIndex, prevOutScript, value, hashType) {
        typeforce(
          types.tuple(types.UInt32, types.Buffer, types.Satoshi, types.UInt32),
          arguments
        );
        let tbuffer = Buffer2.from([]);
        let bufferWriter;
        let hashOutputs = ZERO;
        let hashPrevouts = ZERO;
        let hashSequence = ZERO;
        if (!(hashType & _Transaction.SIGHASH_ANYONECANPAY)) {
          tbuffer = Buffer2.allocUnsafe(36 * this.ins.length);
          bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
          this.ins.forEach((txIn) => {
            bufferWriter.writeSlice(txIn.hash);
            bufferWriter.writeUInt32(txIn.index);
          });
          hashPrevouts = bcrypto.hash256(tbuffer);
        }
        if (!(hashType & _Transaction.SIGHASH_ANYONECANPAY) && (hashType & 31) !== _Transaction.SIGHASH_SINGLE && (hashType & 31) !== _Transaction.SIGHASH_NONE) {
          tbuffer = Buffer2.allocUnsafe(4 * this.ins.length);
          bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
          this.ins.forEach((txIn) => {
            bufferWriter.writeUInt32(txIn.sequence);
          });
          hashSequence = bcrypto.hash256(tbuffer);
        }
        if ((hashType & 31) !== _Transaction.SIGHASH_SINGLE && (hashType & 31) !== _Transaction.SIGHASH_NONE) {
          const txOutsSize = this.outs.reduce((sum, output) => {
            return sum + 8 + varSliceSize(output.script);
          }, 0);
          tbuffer = Buffer2.allocUnsafe(txOutsSize);
          bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
          this.outs.forEach((out) => {
            bufferWriter.writeUInt64(out.value);
            bufferWriter.writeVarSlice(out.script);
          });
          hashOutputs = bcrypto.hash256(tbuffer);
        } else if ((hashType & 31) === _Transaction.SIGHASH_SINGLE && inIndex < this.outs.length) {
          const output = this.outs[inIndex];
          tbuffer = Buffer2.allocUnsafe(8 + varSliceSize(output.script));
          bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
          bufferWriter.writeUInt64(output.value);
          bufferWriter.writeVarSlice(output.script);
          hashOutputs = bcrypto.hash256(tbuffer);
        }
        tbuffer = Buffer2.allocUnsafe(156 + varSliceSize(prevOutScript));
        bufferWriter = new bufferutils_1.BufferWriter(tbuffer, 0);
        const input = this.ins[inIndex];
        bufferWriter.writeInt32(this.version);
        bufferWriter.writeSlice(hashPrevouts);
        bufferWriter.writeSlice(hashSequence);
        bufferWriter.writeSlice(input.hash);
        bufferWriter.writeUInt32(input.index);
        bufferWriter.writeVarSlice(prevOutScript);
        bufferWriter.writeUInt64(value);
        bufferWriter.writeUInt32(input.sequence);
        bufferWriter.writeSlice(hashOutputs);
        bufferWriter.writeUInt32(this.locktime);
        bufferWriter.writeUInt32(hashType);
        return bcrypto.hash256(tbuffer);
      }
      getHash(forWitness) {
        if (forWitness && this.isCoinbase()) return Buffer2.alloc(32, 0);
        return bcrypto.hash256(this.__toBuffer(void 0, void 0, forWitness));
      }
      getId() {
        return (0, bufferutils_1.reverseBuffer)(this.getHash(false)).toString(
          "hex"
        );
      }
      toBuffer(buffer, initialOffset) {
        return this.__toBuffer(buffer, initialOffset, true);
      }
      toHex() {
        return this.toBuffer(void 0, void 0).toString("hex");
      }
      setInputScript(index, scriptSig) {
        typeforce(types.tuple(types.Number, types.Buffer), arguments);
        this.ins[index].script = scriptSig;
      }
      setWitness(index, witness) {
        typeforce(types.tuple(types.Number, [types.Buffer]), arguments);
        this.ins[index].witness = witness;
      }
      __toBuffer(buffer, initialOffset, _ALLOW_WITNESS = false) {
        if (!buffer) buffer = Buffer2.allocUnsafe(this.byteLength(_ALLOW_WITNESS));
        const bufferWriter = new bufferutils_1.BufferWriter(
          buffer,
          initialOffset || 0
        );
        bufferWriter.writeInt32(this.version);
        const hasWitnesses = _ALLOW_WITNESS && this.hasWitnesses();
        if (hasWitnesses) {
          bufferWriter.writeUInt8(_Transaction.ADVANCED_TRANSACTION_MARKER);
          bufferWriter.writeUInt8(_Transaction.ADVANCED_TRANSACTION_FLAG);
        }
        bufferWriter.writeVarInt(this.ins.length);
        this.ins.forEach((txIn) => {
          bufferWriter.writeSlice(txIn.hash);
          bufferWriter.writeUInt32(txIn.index);
          bufferWriter.writeVarSlice(txIn.script);
          bufferWriter.writeUInt32(txIn.sequence);
        });
        bufferWriter.writeVarInt(this.outs.length);
        this.outs.forEach((txOut) => {
          if (isOutput(txOut)) {
            bufferWriter.writeUInt64(txOut.value);
          } else {
            bufferWriter.writeSlice(txOut.valueBuffer);
          }
          bufferWriter.writeVarSlice(txOut.script);
        });
        if (hasWitnesses) {
          this.ins.forEach((input) => {
            bufferWriter.writeVector(input.witness);
          });
        }
        bufferWriter.writeUInt32(this.locktime);
        if (initialOffset !== void 0)
          return buffer.slice(initialOffset, bufferWriter.offset);
        return buffer;
      }
    };
    exports.Transaction = Transaction2;
    Transaction2.DEFAULT_SEQUENCE = 4294967295;
    Transaction2.SIGHASH_DEFAULT = 0;
    Transaction2.SIGHASH_ALL = 1;
    Transaction2.SIGHASH_NONE = 2;
    Transaction2.SIGHASH_SINGLE = 3;
    Transaction2.SIGHASH_ANYONECANPAY = 128;
    Transaction2.SIGHASH_OUTPUT_MASK = 3;
    Transaction2.SIGHASH_INPUT_MASK = 128;
    Transaction2.ADVANCED_TRANSACTION_MARKER = 0;
    Transaction2.ADVANCED_TRANSACTION_FLAG = 1;
  }
});

// node_modules/belcoinjs-lib/src/block.js
var require_block = __commonJS({
  "node_modules/belcoinjs-lib/src/block.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Block = void 0;
    var bufferutils_1 = require_bufferutils();
    var bcrypto = require_crypto2();
    var merkle_1 = require_merkle();
    var transaction_1 = require_transaction();
    var types = require_types();
    var { typeforce } = types;
    var errorMerkleNoTxes = new TypeError(
      "Cannot compute merkle root for zero transactions"
    );
    var errorWitnessNotSegwit = new TypeError(
      "Cannot compute witness commit for non-segwit block"
    );
    var Block = class _Block {
      constructor() {
        this.version = 1;
        this.prevHash = void 0;
        this.merkleRoot = void 0;
        this.timestamp = 0;
        this.witnessCommit = void 0;
        this.bits = 0;
        this.nonce = 0;
        this.transactions = void 0;
      }
      static fromBuffer(buffer) {
        if (buffer.length < 80) throw new Error("Buffer too small (< 80 bytes)");
        const bufferReader = new bufferutils_1.BufferReader(buffer);
        const block = new _Block();
        block.version = bufferReader.readInt32();
        block.prevHash = bufferReader.readSlice(32);
        block.merkleRoot = bufferReader.readSlice(32);
        block.timestamp = bufferReader.readUInt32();
        block.bits = bufferReader.readUInt32();
        block.nonce = bufferReader.readUInt32();
        if (buffer.length === 80) return block;
        const readTransaction = () => {
          const tx = transaction_1.Transaction.fromBuffer(
            bufferReader.buffer.slice(bufferReader.offset),
            true
          );
          bufferReader.offset += tx.byteLength();
          return tx;
        };
        const nTransactions = bufferReader.readVarInt();
        block.transactions = [];
        for (let i = 0; i < nTransactions; ++i) {
          const tx = readTransaction();
          block.transactions.push(tx);
        }
        const witnessCommit = block.getWitnessCommit();
        if (witnessCommit) block.witnessCommit = witnessCommit;
        return block;
      }
      static fromHex(hex) {
        return _Block.fromBuffer(Buffer2.from(hex, "hex"));
      }
      static calculateTarget(bits) {
        const exponent = ((bits & 4278190080) >> 24) - 3;
        const mantissa = bits & 8388607;
        const target = Buffer2.alloc(32, 0);
        target.writeUIntBE(mantissa, 29 - exponent, 3);
        return target;
      }
      static calculateMerkleRoot(transactions, forWitness) {
        typeforce([{ getHash: types.Function }], transactions);
        if (transactions.length === 0) throw errorMerkleNoTxes;
        if (forWitness && !txesHaveWitnessCommit(transactions))
          throw errorWitnessNotSegwit;
        const hashes = transactions.map(
          (transaction) => transaction.getHash(forWitness)
        );
        const rootHash = (0, merkle_1.fastMerkleRoot)(hashes, bcrypto.hash256);
        return forWitness ? bcrypto.hash256(
          Buffer2.concat([rootHash, transactions[0].ins[0].witness[0]])
        ) : rootHash;
      }
      getWitnessCommit() {
        if (!txesHaveWitnessCommit(this.transactions)) return null;
        const witnessCommits = this.transactions[0].outs.filter(
          (out) => out.script.slice(0, 6).equals(Buffer2.from("6a24aa21a9ed", "hex"))
        ).map((out) => out.script.slice(6, 38));
        if (witnessCommits.length === 0) return null;
        const result = witnessCommits[witnessCommits.length - 1];
        if (!(result instanceof Buffer2 && result.length === 32)) return null;
        return result;
      }
      hasWitnessCommit() {
        if (this.witnessCommit instanceof Buffer2 && this.witnessCommit.length === 32)
          return true;
        if (this.getWitnessCommit() !== null) return true;
        return false;
      }
      hasWitness() {
        return anyTxHasWitness(this.transactions);
      }
      weight() {
        const base = this.byteLength(false, false);
        const total = this.byteLength(false, true);
        return base * 3 + total;
      }
      byteLength(headersOnly, allowWitness = true) {
        if (headersOnly || !this.transactions) return 80;
        return 80 + bufferutils_1.varuint.encodingLength(this.transactions.length) + this.transactions.reduce((a, x) => a + x.byteLength(allowWitness), 0);
      }
      getHash() {
        return bcrypto.hash256(this.toBuffer(true));
      }
      getId() {
        return (0, bufferutils_1.reverseBuffer)(this.getHash()).toString("hex");
      }
      getUTCDate() {
        const date = /* @__PURE__ */ new Date(0);
        date.setUTCSeconds(this.timestamp);
        return date;
      }
      // TODO: buffer, offset compatibility
      toBuffer(headersOnly) {
        const buffer = Buffer2.allocUnsafe(this.byteLength(headersOnly));
        const bufferWriter = new bufferutils_1.BufferWriter(buffer);
        bufferWriter.writeInt32(this.version);
        bufferWriter.writeSlice(this.prevHash);
        bufferWriter.writeSlice(this.merkleRoot);
        bufferWriter.writeUInt32(this.timestamp);
        bufferWriter.writeUInt32(this.bits);
        bufferWriter.writeUInt32(this.nonce);
        if (headersOnly || !this.transactions) return buffer;
        bufferutils_1.varuint.encode(
          this.transactions.length,
          buffer,
          bufferWriter.offset
        );
        bufferWriter.offset += bufferutils_1.varuint.encode.bytes;
        this.transactions.forEach((tx) => {
          const txSize = tx.byteLength();
          tx.toBuffer(buffer, bufferWriter.offset);
          bufferWriter.offset += txSize;
        });
        return buffer;
      }
      toHex(headersOnly) {
        return this.toBuffer(headersOnly).toString("hex");
      }
      checkTxRoots() {
        const hasWitnessCommit = this.hasWitnessCommit();
        if (!hasWitnessCommit && this.hasWitness()) return false;
        return this.__checkMerkleRoot() && (hasWitnessCommit ? this.__checkWitnessCommit() : true);
      }
      checkProofOfWork() {
        const hash = (0, bufferutils_1.reverseBuffer)(this.getHash());
        const target = _Block.calculateTarget(this.bits);
        return hash.compare(target) <= 0;
      }
      __checkMerkleRoot() {
        if (!this.transactions) throw errorMerkleNoTxes;
        const actualMerkleRoot = _Block.calculateMerkleRoot(this.transactions);
        return this.merkleRoot.compare(actualMerkleRoot) === 0;
      }
      __checkWitnessCommit() {
        if (!this.transactions) throw errorMerkleNoTxes;
        if (!this.hasWitnessCommit()) throw errorWitnessNotSegwit;
        const actualWitnessCommit = _Block.calculateMerkleRoot(
          this.transactions,
          true
        );
        return this.witnessCommit.compare(actualWitnessCommit) === 0;
      }
    };
    exports.Block = Block;
    function txesHaveWitnessCommit(transactions) {
      return transactions instanceof Array && transactions[0] && transactions[0].ins && transactions[0].ins instanceof Array && transactions[0].ins[0] && transactions[0].ins[0].witness && transactions[0].ins[0].witness instanceof Array && transactions[0].ins[0].witness.length > 0;
    }
    function anyTxHasWitness(transactions) {
      return transactions instanceof Array && transactions.some(
        (tx) => typeof tx === "object" && tx.ins instanceof Array && tx.ins.some(
          (input) => typeof input === "object" && input.witness instanceof Array && input.witness.length > 0
        )
      );
    }
  }
});

// node_modules/bip174/src/lib/typeFields.js
var require_typeFields = __commonJS({
  "node_modules/bip174/src/lib/typeFields.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var GlobalTypes;
    (function(GlobalTypes2) {
      GlobalTypes2[GlobalTypes2["UNSIGNED_TX"] = 0] = "UNSIGNED_TX";
      GlobalTypes2[GlobalTypes2["GLOBAL_XPUB"] = 1] = "GLOBAL_XPUB";
    })(GlobalTypes = exports.GlobalTypes || (exports.GlobalTypes = {}));
    exports.GLOBAL_TYPE_NAMES = ["unsignedTx", "globalXpub"];
    var InputTypes;
    (function(InputTypes2) {
      InputTypes2[InputTypes2["NON_WITNESS_UTXO"] = 0] = "NON_WITNESS_UTXO";
      InputTypes2[InputTypes2["WITNESS_UTXO"] = 1] = "WITNESS_UTXO";
      InputTypes2[InputTypes2["PARTIAL_SIG"] = 2] = "PARTIAL_SIG";
      InputTypes2[InputTypes2["SIGHASH_TYPE"] = 3] = "SIGHASH_TYPE";
      InputTypes2[InputTypes2["REDEEM_SCRIPT"] = 4] = "REDEEM_SCRIPT";
      InputTypes2[InputTypes2["WITNESS_SCRIPT"] = 5] = "WITNESS_SCRIPT";
      InputTypes2[InputTypes2["BIP32_DERIVATION"] = 6] = "BIP32_DERIVATION";
      InputTypes2[InputTypes2["FINAL_SCRIPTSIG"] = 7] = "FINAL_SCRIPTSIG";
      InputTypes2[InputTypes2["FINAL_SCRIPTWITNESS"] = 8] = "FINAL_SCRIPTWITNESS";
      InputTypes2[InputTypes2["POR_COMMITMENT"] = 9] = "POR_COMMITMENT";
      InputTypes2[InputTypes2["TAP_KEY_SIG"] = 19] = "TAP_KEY_SIG";
      InputTypes2[InputTypes2["TAP_SCRIPT_SIG"] = 20] = "TAP_SCRIPT_SIG";
      InputTypes2[InputTypes2["TAP_LEAF_SCRIPT"] = 21] = "TAP_LEAF_SCRIPT";
      InputTypes2[InputTypes2["TAP_BIP32_DERIVATION"] = 22] = "TAP_BIP32_DERIVATION";
      InputTypes2[InputTypes2["TAP_INTERNAL_KEY"] = 23] = "TAP_INTERNAL_KEY";
      InputTypes2[InputTypes2["TAP_MERKLE_ROOT"] = 24] = "TAP_MERKLE_ROOT";
    })(InputTypes = exports.InputTypes || (exports.InputTypes = {}));
    exports.INPUT_TYPE_NAMES = [
      "nonWitnessUtxo",
      "witnessUtxo",
      "partialSig",
      "sighashType",
      "redeemScript",
      "witnessScript",
      "bip32Derivation",
      "finalScriptSig",
      "finalScriptWitness",
      "porCommitment",
      "tapKeySig",
      "tapScriptSig",
      "tapLeafScript",
      "tapBip32Derivation",
      "tapInternalKey",
      "tapMerkleRoot"
    ];
    var OutputTypes;
    (function(OutputTypes2) {
      OutputTypes2[OutputTypes2["REDEEM_SCRIPT"] = 0] = "REDEEM_SCRIPT";
      OutputTypes2[OutputTypes2["WITNESS_SCRIPT"] = 1] = "WITNESS_SCRIPT";
      OutputTypes2[OutputTypes2["BIP32_DERIVATION"] = 2] = "BIP32_DERIVATION";
      OutputTypes2[OutputTypes2["TAP_INTERNAL_KEY"] = 5] = "TAP_INTERNAL_KEY";
      OutputTypes2[OutputTypes2["TAP_TREE"] = 6] = "TAP_TREE";
      OutputTypes2[OutputTypes2["TAP_BIP32_DERIVATION"] = 7] = "TAP_BIP32_DERIVATION";
    })(OutputTypes = exports.OutputTypes || (exports.OutputTypes = {}));
    exports.OUTPUT_TYPE_NAMES = [
      "redeemScript",
      "witnessScript",
      "bip32Derivation",
      "tapInternalKey",
      "tapTree",
      "tapBip32Derivation"
    ];
  }
});

// node_modules/bip174/src/lib/converter/global/globalXpub.js
var require_globalXpub = __commonJS({
  "node_modules/bip174/src/lib/converter/global/globalXpub.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    var range = (n) => [...Array(n).keys()];
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.GlobalTypes.GLOBAL_XPUB) {
        throw new Error(
          "Decode Error: could not decode globalXpub with key 0x" + keyVal.key.toString("hex")
        );
      }
      if (keyVal.key.length !== 79 || ![2, 3].includes(keyVal.key[46])) {
        throw new Error(
          "Decode Error: globalXpub has invalid extended pubkey in key 0x" + keyVal.key.toString("hex")
        );
      }
      if (keyVal.value.length / 4 % 1 !== 0) {
        throw new Error(
          "Decode Error: Global GLOBAL_XPUB value length should be multiple of 4"
        );
      }
      const extendedPubkey = keyVal.key.slice(1);
      const data = {
        masterFingerprint: keyVal.value.slice(0, 4),
        extendedPubkey,
        path: "m"
      };
      for (const i of range(keyVal.value.length / 4 - 1)) {
        const val = keyVal.value.readUInt32LE(i * 4 + 4);
        const isHard = !!(val & 2147483648);
        const idx = val & 2147483647;
        data.path += "/" + idx.toString(10) + (isHard ? "'" : "");
      }
      return data;
    }
    exports.decode = decode;
    function encode(data) {
      const head = Buffer2.from([typeFields_1.GlobalTypes.GLOBAL_XPUB]);
      const key = Buffer2.concat([head, data.extendedPubkey]);
      const splitPath = data.path.split("/");
      const value = Buffer2.allocUnsafe(splitPath.length * 4);
      data.masterFingerprint.copy(value, 0);
      let offset = 4;
      splitPath.slice(1).forEach((level) => {
        const isHard = level.slice(-1) === "'";
        let num = 2147483647 & parseInt(isHard ? level.slice(0, -1) : level, 10);
        if (isHard) num += 2147483648;
        value.writeUInt32LE(num, offset);
        offset += 4;
      });
      return {
        key,
        value
      };
    }
    exports.encode = encode;
    exports.expected = "{ masterFingerprint: Buffer; extendedPubkey: Buffer; path: string; }";
    function check(data) {
      const epk = data.extendedPubkey;
      const mfp = data.masterFingerprint;
      const p = data.path;
      return Buffer2.isBuffer(epk) && epk.length === 78 && [2, 3].indexOf(epk[45]) > -1 && Buffer2.isBuffer(mfp) && mfp.length === 4 && typeof p === "string" && !!p.match(/^m(\/\d+'?)*$/);
    }
    exports.check = check;
    function canAddToArray(array, item, dupeSet) {
      const dupeString = item.extendedPubkey.toString("hex");
      if (dupeSet.has(dupeString)) return false;
      dupeSet.add(dupeString);
      return array.filter((v) => v.extendedPubkey.equals(item.extendedPubkey)).length === 0;
    }
    exports.canAddToArray = canAddToArray;
  }
});

// node_modules/bip174/src/lib/converter/global/unsignedTx.js
var require_unsignedTx = __commonJS({
  "node_modules/bip174/src/lib/converter/global/unsignedTx.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function encode(data) {
      return {
        key: Buffer2.from([typeFields_1.GlobalTypes.UNSIGNED_TX]),
        value: data.toBuffer()
      };
    }
    exports.encode = encode;
  }
});

// node_modules/bip174/src/lib/converter/input/finalScriptSig.js
var require_finalScriptSig = __commonJS({
  "node_modules/bip174/src/lib/converter/input/finalScriptSig.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.FINAL_SCRIPTSIG) {
        throw new Error(
          "Decode Error: could not decode finalScriptSig with key 0x" + keyVal.key.toString("hex")
        );
      }
      return keyVal.value;
    }
    exports.decode = decode;
    function encode(data) {
      const key = Buffer2.from([typeFields_1.InputTypes.FINAL_SCRIPTSIG]);
      return {
        key,
        value: data
      };
    }
    exports.encode = encode;
    exports.expected = "Buffer";
    function check(data) {
      return Buffer2.isBuffer(data);
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.finalScriptSig === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/finalScriptWitness.js
var require_finalScriptWitness = __commonJS({
  "node_modules/bip174/src/lib/converter/input/finalScriptWitness.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.FINAL_SCRIPTWITNESS) {
        throw new Error(
          "Decode Error: could not decode finalScriptWitness with key 0x" + keyVal.key.toString("hex")
        );
      }
      return keyVal.value;
    }
    exports.decode = decode;
    function encode(data) {
      const key = Buffer2.from([typeFields_1.InputTypes.FINAL_SCRIPTWITNESS]);
      return {
        key,
        value: data
      };
    }
    exports.encode = encode;
    exports.expected = "Buffer";
    function check(data) {
      return Buffer2.isBuffer(data);
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.finalScriptWitness === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/nonWitnessUtxo.js
var require_nonWitnessUtxo = __commonJS({
  "node_modules/bip174/src/lib/converter/input/nonWitnessUtxo.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.NON_WITNESS_UTXO) {
        throw new Error(
          "Decode Error: could not decode nonWitnessUtxo with key 0x" + keyVal.key.toString("hex")
        );
      }
      return keyVal.value;
    }
    exports.decode = decode;
    function encode(data) {
      return {
        key: Buffer2.from([typeFields_1.InputTypes.NON_WITNESS_UTXO]),
        value: data
      };
    }
    exports.encode = encode;
    exports.expected = "Buffer";
    function check(data) {
      return Buffer2.isBuffer(data);
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.nonWitnessUtxo === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/partialSig.js
var require_partialSig = __commonJS({
  "node_modules/bip174/src/lib/converter/input/partialSig.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.PARTIAL_SIG) {
        throw new Error(
          "Decode Error: could not decode partialSig with key 0x" + keyVal.key.toString("hex")
        );
      }
      if (!(keyVal.key.length === 34 || keyVal.key.length === 66) || ![2, 3, 4].includes(keyVal.key[1])) {
        throw new Error(
          "Decode Error: partialSig has invalid pubkey in key 0x" + keyVal.key.toString("hex")
        );
      }
      const pubkey = keyVal.key.slice(1);
      return {
        pubkey,
        signature: keyVal.value
      };
    }
    exports.decode = decode;
    function encode(pSig) {
      const head = Buffer2.from([typeFields_1.InputTypes.PARTIAL_SIG]);
      return {
        key: Buffer2.concat([head, pSig.pubkey]),
        value: pSig.signature
      };
    }
    exports.encode = encode;
    exports.expected = "{ pubkey: Buffer; signature: Buffer; }";
    function check(data) {
      return Buffer2.isBuffer(data.pubkey) && Buffer2.isBuffer(data.signature) && [33, 65].includes(data.pubkey.length) && [2, 3, 4].includes(data.pubkey[0]) && isDerSigWithSighash(data.signature);
    }
    exports.check = check;
    function isDerSigWithSighash(buf) {
      if (!Buffer2.isBuffer(buf) || buf.length < 9) return false;
      if (buf[0] !== 48) return false;
      if (buf.length !== buf[1] + 3) return false;
      if (buf[2] !== 2) return false;
      const rLen = buf[3];
      if (rLen > 33 || rLen < 1) return false;
      if (buf[3 + rLen + 1] !== 2) return false;
      const sLen = buf[3 + rLen + 2];
      if (sLen > 33 || sLen < 1) return false;
      if (buf.length !== 3 + rLen + 2 + sLen + 2) return false;
      return true;
    }
    function canAddToArray(array, item, dupeSet) {
      const dupeString = item.pubkey.toString("hex");
      if (dupeSet.has(dupeString)) return false;
      dupeSet.add(dupeString);
      return array.filter((v) => v.pubkey.equals(item.pubkey)).length === 0;
    }
    exports.canAddToArray = canAddToArray;
  }
});

// node_modules/bip174/src/lib/converter/input/porCommitment.js
var require_porCommitment = __commonJS({
  "node_modules/bip174/src/lib/converter/input/porCommitment.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.POR_COMMITMENT) {
        throw new Error(
          "Decode Error: could not decode porCommitment with key 0x" + keyVal.key.toString("hex")
        );
      }
      return keyVal.value.toString("utf8");
    }
    exports.decode = decode;
    function encode(data) {
      const key = Buffer2.from([typeFields_1.InputTypes.POR_COMMITMENT]);
      return {
        key,
        value: Buffer2.from(data, "utf8")
      };
    }
    exports.encode = encode;
    exports.expected = "string";
    function check(data) {
      return typeof data === "string";
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.porCommitment === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/sighashType.js
var require_sighashType = __commonJS({
  "node_modules/bip174/src/lib/converter/input/sighashType.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.SIGHASH_TYPE) {
        throw new Error(
          "Decode Error: could not decode sighashType with key 0x" + keyVal.key.toString("hex")
        );
      }
      return keyVal.value.readUInt32LE(0);
    }
    exports.decode = decode;
    function encode(data) {
      const key = Buffer2.from([typeFields_1.InputTypes.SIGHASH_TYPE]);
      const value = Buffer2.allocUnsafe(4);
      value.writeUInt32LE(data, 0);
      return {
        key,
        value
      };
    }
    exports.encode = encode;
    exports.expected = "number";
    function check(data) {
      return typeof data === "number";
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.sighashType === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/tapKeySig.js
var require_tapKeySig = __commonJS({
  "node_modules/bip174/src/lib/converter/input/tapKeySig.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.TAP_KEY_SIG || keyVal.key.length !== 1) {
        throw new Error(
          "Decode Error: could not decode tapKeySig with key 0x" + keyVal.key.toString("hex")
        );
      }
      if (!check(keyVal.value)) {
        throw new Error(
          "Decode Error: tapKeySig not a valid 64-65-byte BIP340 signature"
        );
      }
      return keyVal.value;
    }
    exports.decode = decode;
    function encode(value) {
      const key = Buffer2.from([typeFields_1.InputTypes.TAP_KEY_SIG]);
      return { key, value };
    }
    exports.encode = encode;
    exports.expected = "Buffer";
    function check(data) {
      return Buffer2.isBuffer(data) && (data.length === 64 || data.length === 65);
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.tapKeySig === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/tapLeafScript.js
var require_tapLeafScript = __commonJS({
  "node_modules/bip174/src/lib/converter/input/tapLeafScript.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.TAP_LEAF_SCRIPT) {
        throw new Error(
          "Decode Error: could not decode tapLeafScript with key 0x" + keyVal.key.toString("hex")
        );
      }
      if ((keyVal.key.length - 2) % 32 !== 0) {
        throw new Error(
          "Decode Error: tapLeafScript has invalid control block in key 0x" + keyVal.key.toString("hex")
        );
      }
      const leafVersion = keyVal.value[keyVal.value.length - 1];
      if ((keyVal.key[1] & 254) !== leafVersion) {
        throw new Error(
          "Decode Error: tapLeafScript bad leaf version in key 0x" + keyVal.key.toString("hex")
        );
      }
      const script = keyVal.value.slice(0, -1);
      const controlBlock = keyVal.key.slice(1);
      return { controlBlock, script, leafVersion };
    }
    exports.decode = decode;
    function encode(tScript) {
      const head = Buffer2.from([typeFields_1.InputTypes.TAP_LEAF_SCRIPT]);
      const verBuf = Buffer2.from([tScript.leafVersion]);
      return {
        key: Buffer2.concat([head, tScript.controlBlock]),
        value: Buffer2.concat([tScript.script, verBuf])
      };
    }
    exports.encode = encode;
    exports.expected = "{ controlBlock: Buffer; leafVersion: number, script: Buffer; }";
    function check(data) {
      return Buffer2.isBuffer(data.controlBlock) && (data.controlBlock.length - 1) % 32 === 0 && (data.controlBlock[0] & 254) === data.leafVersion && Buffer2.isBuffer(data.script);
    }
    exports.check = check;
    function canAddToArray(array, item, dupeSet) {
      const dupeString = item.controlBlock.toString("hex");
      if (dupeSet.has(dupeString)) return false;
      dupeSet.add(dupeString);
      return array.filter((v) => v.controlBlock.equals(item.controlBlock)).length === 0;
    }
    exports.canAddToArray = canAddToArray;
  }
});

// node_modules/bip174/src/lib/converter/input/tapMerkleRoot.js
var require_tapMerkleRoot = __commonJS({
  "node_modules/bip174/src/lib/converter/input/tapMerkleRoot.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.TAP_MERKLE_ROOT || keyVal.key.length !== 1) {
        throw new Error(
          "Decode Error: could not decode tapMerkleRoot with key 0x" + keyVal.key.toString("hex")
        );
      }
      if (!check(keyVal.value)) {
        throw new Error("Decode Error: tapMerkleRoot not a 32-byte hash");
      }
      return keyVal.value;
    }
    exports.decode = decode;
    function encode(value) {
      const key = Buffer2.from([typeFields_1.InputTypes.TAP_MERKLE_ROOT]);
      return { key, value };
    }
    exports.encode = encode;
    exports.expected = "Buffer";
    function check(data) {
      return Buffer2.isBuffer(data) && data.length === 32;
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.tapMerkleRoot === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/input/tapScriptSig.js
var require_tapScriptSig = __commonJS({
  "node_modules/bip174/src/lib/converter/input/tapScriptSig.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.TAP_SCRIPT_SIG) {
        throw new Error(
          "Decode Error: could not decode tapScriptSig with key 0x" + keyVal.key.toString("hex")
        );
      }
      if (keyVal.key.length !== 65) {
        throw new Error(
          "Decode Error: tapScriptSig has invalid key 0x" + keyVal.key.toString("hex")
        );
      }
      if (keyVal.value.length !== 64 && keyVal.value.length !== 65) {
        throw new Error(
          "Decode Error: tapScriptSig has invalid signature in key 0x" + keyVal.key.toString("hex")
        );
      }
      const pubkey = keyVal.key.slice(1, 33);
      const leafHash = keyVal.key.slice(33);
      return {
        pubkey,
        leafHash,
        signature: keyVal.value
      };
    }
    exports.decode = decode;
    function encode(tSig) {
      const head = Buffer2.from([typeFields_1.InputTypes.TAP_SCRIPT_SIG]);
      return {
        key: Buffer2.concat([head, tSig.pubkey, tSig.leafHash]),
        value: tSig.signature
      };
    }
    exports.encode = encode;
    exports.expected = "{ pubkey: Buffer; leafHash: Buffer; signature: Buffer; }";
    function check(data) {
      return Buffer2.isBuffer(data.pubkey) && Buffer2.isBuffer(data.leafHash) && Buffer2.isBuffer(data.signature) && data.pubkey.length === 32 && data.leafHash.length === 32 && (data.signature.length === 64 || data.signature.length === 65);
    }
    exports.check = check;
    function canAddToArray(array, item, dupeSet) {
      const dupeString = item.pubkey.toString("hex") + item.leafHash.toString("hex");
      if (dupeSet.has(dupeString)) return false;
      dupeSet.add(dupeString);
      return array.filter(
        (v) => v.pubkey.equals(item.pubkey) && v.leafHash.equals(item.leafHash)
      ).length === 0;
    }
    exports.canAddToArray = canAddToArray;
  }
});

// node_modules/bip174/src/lib/converter/varint.js
var require_varint = __commonJS({
  "node_modules/bip174/src/lib/converter/varint.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var MAX_SAFE_INTEGER = 9007199254740991;
    function checkUInt53(n) {
      if (n < 0 || n > MAX_SAFE_INTEGER || n % 1 !== 0)
        throw new RangeError("value out of range");
    }
    function encode(_number, buffer, offset) {
      checkUInt53(_number);
      if (!buffer) buffer = Buffer2.allocUnsafe(encodingLength(_number));
      if (!Buffer2.isBuffer(buffer))
        throw new TypeError("buffer must be a Buffer instance");
      if (!offset) offset = 0;
      if (_number < 253) {
        buffer.writeUInt8(_number, offset);
        Object.assign(encode, { bytes: 1 });
      } else if (_number <= 65535) {
        buffer.writeUInt8(253, offset);
        buffer.writeUInt16LE(_number, offset + 1);
        Object.assign(encode, { bytes: 3 });
      } else if (_number <= 4294967295) {
        buffer.writeUInt8(254, offset);
        buffer.writeUInt32LE(_number, offset + 1);
        Object.assign(encode, { bytes: 5 });
      } else {
        buffer.writeUInt8(255, offset);
        buffer.writeUInt32LE(_number >>> 0, offset + 1);
        buffer.writeUInt32LE(_number / 4294967296 | 0, offset + 5);
        Object.assign(encode, { bytes: 9 });
      }
      return buffer;
    }
    exports.encode = encode;
    function decode(buffer, offset) {
      if (!Buffer2.isBuffer(buffer))
        throw new TypeError("buffer must be a Buffer instance");
      if (!offset) offset = 0;
      const first = buffer.readUInt8(offset);
      if (first < 253) {
        Object.assign(decode, { bytes: 1 });
        return first;
      } else if (first === 253) {
        Object.assign(decode, { bytes: 3 });
        return buffer.readUInt16LE(offset + 1);
      } else if (first === 254) {
        Object.assign(decode, { bytes: 5 });
        return buffer.readUInt32LE(offset + 1);
      } else {
        Object.assign(decode, { bytes: 9 });
        const lo = buffer.readUInt32LE(offset + 1);
        const hi = buffer.readUInt32LE(offset + 5);
        const _number = hi * 4294967296 + lo;
        checkUInt53(_number);
        return _number;
      }
    }
    exports.decode = decode;
    function encodingLength(_number) {
      checkUInt53(_number);
      return _number < 253 ? 1 : _number <= 65535 ? 3 : _number <= 4294967295 ? 5 : 9;
    }
    exports.encodingLength = encodingLength;
  }
});

// node_modules/bip174/src/lib/converter/tools.js
var require_tools = __commonJS({
  "node_modules/bip174/src/lib/converter/tools.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var varuint = require_varint();
    exports.range = (n) => [...Array(n).keys()];
    function reverseBuffer(buffer) {
      if (buffer.length < 1) return buffer;
      let j = buffer.length - 1;
      let tmp = 0;
      for (let i = 0; i < buffer.length / 2; i++) {
        tmp = buffer[i];
        buffer[i] = buffer[j];
        buffer[j] = tmp;
        j--;
      }
      return buffer;
    }
    exports.reverseBuffer = reverseBuffer;
    function keyValsToBuffer(keyVals) {
      const buffers = keyVals.map(keyValToBuffer);
      buffers.push(Buffer2.from([0]));
      return Buffer2.concat(buffers);
    }
    exports.keyValsToBuffer = keyValsToBuffer;
    function keyValToBuffer(keyVal) {
      const keyLen = keyVal.key.length;
      const valLen = keyVal.value.length;
      const keyVarIntLen = varuint.encodingLength(keyLen);
      const valVarIntLen = varuint.encodingLength(valLen);
      const buffer = Buffer2.allocUnsafe(
        keyVarIntLen + keyLen + valVarIntLen + valLen
      );
      varuint.encode(keyLen, buffer, 0);
      keyVal.key.copy(buffer, keyVarIntLen);
      varuint.encode(valLen, buffer, keyVarIntLen + keyLen);
      keyVal.value.copy(buffer, keyVarIntLen + keyLen + valVarIntLen);
      return buffer;
    }
    exports.keyValToBuffer = keyValToBuffer;
    function verifuint(value, max) {
      if (typeof value !== "number")
        throw new Error("cannot write a non-number as a number");
      if (value < 0)
        throw new Error("specified a negative value for writing an unsigned value");
      if (value > max) throw new Error("RangeError: value out of range");
      if (Math.floor(value) !== value)
        throw new Error("value has a fractional component");
    }
    function readUInt64LE(buffer, offset) {
      const a = buffer.readUInt32LE(offset);
      let b = buffer.readUInt32LE(offset + 4);
      b *= 4294967296;
      verifuint(b + a, 9007199254740991);
      return b + a;
    }
    exports.readUInt64LE = readUInt64LE;
    function writeUInt64LE(buffer, value, offset) {
      verifuint(value, 9007199254740991);
      buffer.writeInt32LE(value & -1, offset);
      buffer.writeUInt32LE(Math.floor(value / 4294967296), offset + 4);
      return offset + 8;
    }
    exports.writeUInt64LE = writeUInt64LE;
  }
});

// node_modules/bip174/src/lib/converter/input/witnessUtxo.js
var require_witnessUtxo = __commonJS({
  "node_modules/bip174/src/lib/converter/input/witnessUtxo.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    var tools_1 = require_tools();
    var varuint = require_varint();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.InputTypes.WITNESS_UTXO) {
        throw new Error(
          "Decode Error: could not decode witnessUtxo with key 0x" + keyVal.key.toString("hex")
        );
      }
      const value = tools_1.readUInt64LE(keyVal.value, 0);
      let _offset = 8;
      const scriptLen = varuint.decode(keyVal.value, _offset);
      _offset += varuint.encodingLength(scriptLen);
      const script = keyVal.value.slice(_offset);
      if (script.length !== scriptLen) {
        throw new Error("Decode Error: WITNESS_UTXO script is not proper length");
      }
      return {
        script,
        value
      };
    }
    exports.decode = decode;
    function encode(data) {
      const { script, value } = data;
      const varintLen = varuint.encodingLength(script.length);
      const result = Buffer2.allocUnsafe(8 + varintLen + script.length);
      tools_1.writeUInt64LE(result, value, 0);
      varuint.encode(script.length, result, 8);
      script.copy(result, 8 + varintLen);
      return {
        key: Buffer2.from([typeFields_1.InputTypes.WITNESS_UTXO]),
        value: result
      };
    }
    exports.encode = encode;
    exports.expected = "{ script: Buffer; value: number; }";
    function check(data) {
      return Buffer2.isBuffer(data.script) && typeof data.value === "number";
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.witnessUtxo === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/output/tapTree.js
var require_tapTree = __commonJS({
  "node_modules/bip174/src/lib/converter/output/tapTree.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    var varuint = require_varint();
    function decode(keyVal) {
      if (keyVal.key[0] !== typeFields_1.OutputTypes.TAP_TREE || keyVal.key.length !== 1) {
        throw new Error(
          "Decode Error: could not decode tapTree with key 0x" + keyVal.key.toString("hex")
        );
      }
      let _offset = 0;
      const data = [];
      while (_offset < keyVal.value.length) {
        const depth = keyVal.value[_offset++];
        const leafVersion = keyVal.value[_offset++];
        const scriptLen = varuint.decode(keyVal.value, _offset);
        _offset += varuint.encodingLength(scriptLen);
        data.push({
          depth,
          leafVersion,
          script: keyVal.value.slice(_offset, _offset + scriptLen)
        });
        _offset += scriptLen;
      }
      return { leaves: data };
    }
    exports.decode = decode;
    function encode(tree) {
      const key = Buffer2.from([typeFields_1.OutputTypes.TAP_TREE]);
      const bufs = [].concat(
        ...tree.leaves.map((tapLeaf) => [
          Buffer2.of(tapLeaf.depth, tapLeaf.leafVersion),
          varuint.encode(tapLeaf.script.length),
          tapLeaf.script
        ])
      );
      return {
        key,
        value: Buffer2.concat(bufs)
      };
    }
    exports.encode = encode;
    exports.expected = "{ leaves: [{ depth: number; leafVersion: number, script: Buffer; }] }";
    function check(data) {
      return Array.isArray(data.leaves) && data.leaves.every(
        (tapLeaf) => tapLeaf.depth >= 0 && tapLeaf.depth <= 128 && (tapLeaf.leafVersion & 254) === tapLeaf.leafVersion && Buffer2.isBuffer(tapLeaf.script)
      );
    }
    exports.check = check;
    function canAdd(currentData, newData) {
      return !!currentData && !!newData && currentData.tapTree === void 0;
    }
    exports.canAdd = canAdd;
  }
});

// node_modules/bip174/src/lib/converter/shared/bip32Derivation.js
var require_bip32Derivation = __commonJS({
  "node_modules/bip174/src/lib/converter/shared/bip32Derivation.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var range = (n) => [...Array(n).keys()];
    var isValidDERKey = (pubkey) => pubkey.length === 33 && [2, 3].includes(pubkey[0]) || pubkey.length === 65 && 4 === pubkey[0];
    function makeConverter(TYPE_BYTE, isValidPubkey = isValidDERKey) {
      function decode(keyVal) {
        if (keyVal.key[0] !== TYPE_BYTE) {
          throw new Error(
            "Decode Error: could not decode bip32Derivation with key 0x" + keyVal.key.toString("hex")
          );
        }
        const pubkey = keyVal.key.slice(1);
        if (!isValidPubkey(pubkey)) {
          throw new Error(
            "Decode Error: bip32Derivation has invalid pubkey in key 0x" + keyVal.key.toString("hex")
          );
        }
        if (keyVal.value.length / 4 % 1 !== 0) {
          throw new Error(
            "Decode Error: Input BIP32_DERIVATION value length should be multiple of 4"
          );
        }
        const data = {
          masterFingerprint: keyVal.value.slice(0, 4),
          pubkey,
          path: "m"
        };
        for (const i of range(keyVal.value.length / 4 - 1)) {
          const val = keyVal.value.readUInt32LE(i * 4 + 4);
          const isHard = !!(val & 2147483648);
          const idx = val & 2147483647;
          data.path += "/" + idx.toString(10) + (isHard ? "'" : "");
        }
        return data;
      }
      function encode(data) {
        const head = Buffer2.from([TYPE_BYTE]);
        const key = Buffer2.concat([head, data.pubkey]);
        const splitPath = data.path.split("/");
        const value = Buffer2.allocUnsafe(splitPath.length * 4);
        data.masterFingerprint.copy(value, 0);
        let offset = 4;
        splitPath.slice(1).forEach((level) => {
          const isHard = level.slice(-1) === "'";
          let num = 2147483647 & parseInt(isHard ? level.slice(0, -1) : level, 10);
          if (isHard) num += 2147483648;
          value.writeUInt32LE(num, offset);
          offset += 4;
        });
        return {
          key,
          value
        };
      }
      const expected = "{ masterFingerprint: Buffer; pubkey: Buffer; path: string; }";
      function check(data) {
        return Buffer2.isBuffer(data.pubkey) && Buffer2.isBuffer(data.masterFingerprint) && typeof data.path === "string" && isValidPubkey(data.pubkey) && data.masterFingerprint.length === 4;
      }
      function canAddToArray(array, item, dupeSet) {
        const dupeString = item.pubkey.toString("hex");
        if (dupeSet.has(dupeString)) return false;
        dupeSet.add(dupeString);
        return array.filter((v) => v.pubkey.equals(item.pubkey)).length === 0;
      }
      return {
        decode,
        encode,
        check,
        expected,
        canAddToArray
      };
    }
    exports.makeConverter = makeConverter;
  }
});

// node_modules/bip174/src/lib/converter/shared/checkPubkey.js
var require_checkPubkey = __commonJS({
  "node_modules/bip174/src/lib/converter/shared/checkPubkey.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    function makeChecker(pubkeyTypes) {
      return checkPubkey;
      function checkPubkey(keyVal) {
        let pubkey;
        if (pubkeyTypes.includes(keyVal.key[0])) {
          pubkey = keyVal.key.slice(1);
          if (!(pubkey.length === 33 || pubkey.length === 65) || ![2, 3, 4].includes(pubkey[0])) {
            throw new Error(
              "Format Error: invalid pubkey in key 0x" + keyVal.key.toString("hex")
            );
          }
        }
        return pubkey;
      }
    }
    exports.makeChecker = makeChecker;
  }
});

// node_modules/bip174/src/lib/converter/shared/redeemScript.js
var require_redeemScript = __commonJS({
  "node_modules/bip174/src/lib/converter/shared/redeemScript.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    function makeConverter(TYPE_BYTE) {
      function decode(keyVal) {
        if (keyVal.key[0] !== TYPE_BYTE) {
          throw new Error(
            "Decode Error: could not decode redeemScript with key 0x" + keyVal.key.toString("hex")
          );
        }
        return keyVal.value;
      }
      function encode(data) {
        const key = Buffer2.from([TYPE_BYTE]);
        return {
          key,
          value: data
        };
      }
      const expected = "Buffer";
      function check(data) {
        return Buffer2.isBuffer(data);
      }
      function canAdd(currentData, newData) {
        return !!currentData && !!newData && currentData.redeemScript === void 0;
      }
      return {
        decode,
        encode,
        check,
        expected,
        canAdd
      };
    }
    exports.makeConverter = makeConverter;
  }
});

// node_modules/bip174/src/lib/converter/shared/tapBip32Derivation.js
var require_tapBip32Derivation = __commonJS({
  "node_modules/bip174/src/lib/converter/shared/tapBip32Derivation.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var varuint = require_varint();
    var bip32Derivation = require_bip32Derivation();
    var isValidBIP340Key = (pubkey) => pubkey.length === 32;
    function makeConverter(TYPE_BYTE) {
      const parent = bip32Derivation.makeConverter(TYPE_BYTE, isValidBIP340Key);
      function decode(keyVal) {
        const nHashes = varuint.decode(keyVal.value);
        const nHashesLen = varuint.encodingLength(nHashes);
        const base = parent.decode({
          key: keyVal.key,
          value: keyVal.value.slice(nHashesLen + nHashes * 32)
        });
        const leafHashes = new Array(nHashes);
        for (let i = 0, _offset = nHashesLen; i < nHashes; i++, _offset += 32) {
          leafHashes[i] = keyVal.value.slice(_offset, _offset + 32);
        }
        return Object.assign({}, base, { leafHashes });
      }
      function encode(data) {
        const base = parent.encode(data);
        const nHashesLen = varuint.encodingLength(data.leafHashes.length);
        const nHashesBuf = Buffer2.allocUnsafe(nHashesLen);
        varuint.encode(data.leafHashes.length, nHashesBuf);
        const value = Buffer2.concat([nHashesBuf, ...data.leafHashes, base.value]);
        return Object.assign({}, base, { value });
      }
      const expected = "{ masterFingerprint: Buffer; pubkey: Buffer; path: string; leafHashes: Buffer[]; }";
      function check(data) {
        return Array.isArray(data.leafHashes) && data.leafHashes.every(
          (leafHash) => Buffer2.isBuffer(leafHash) && leafHash.length === 32
        ) && parent.check(data);
      }
      return {
        decode,
        encode,
        check,
        expected,
        canAddToArray: parent.canAddToArray
      };
    }
    exports.makeConverter = makeConverter;
  }
});

// node_modules/bip174/src/lib/converter/shared/tapInternalKey.js
var require_tapInternalKey = __commonJS({
  "node_modules/bip174/src/lib/converter/shared/tapInternalKey.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    function makeConverter(TYPE_BYTE) {
      function decode(keyVal) {
        if (keyVal.key[0] !== TYPE_BYTE || keyVal.key.length !== 1) {
          throw new Error(
            "Decode Error: could not decode tapInternalKey with key 0x" + keyVal.key.toString("hex")
          );
        }
        if (keyVal.value.length !== 32) {
          throw new Error(
            "Decode Error: tapInternalKey not a 32-byte x-only pubkey"
          );
        }
        return keyVal.value;
      }
      function encode(value) {
        const key = Buffer2.from([TYPE_BYTE]);
        return { key, value };
      }
      const expected = "Buffer";
      function check(data) {
        return Buffer2.isBuffer(data) && data.length === 32;
      }
      function canAdd(currentData, newData) {
        return !!currentData && !!newData && currentData.tapInternalKey === void 0;
      }
      return {
        decode,
        encode,
        check,
        expected,
        canAdd
      };
    }
    exports.makeConverter = makeConverter;
  }
});

// node_modules/bip174/src/lib/converter/shared/witnessScript.js
var require_witnessScript = __commonJS({
  "node_modules/bip174/src/lib/converter/shared/witnessScript.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    function makeConverter(TYPE_BYTE) {
      function decode(keyVal) {
        if (keyVal.key[0] !== TYPE_BYTE) {
          throw new Error(
            "Decode Error: could not decode witnessScript with key 0x" + keyVal.key.toString("hex")
          );
        }
        return keyVal.value;
      }
      function encode(data) {
        const key = Buffer2.from([TYPE_BYTE]);
        return {
          key,
          value: data
        };
      }
      const expected = "Buffer";
      function check(data) {
        return Buffer2.isBuffer(data);
      }
      function canAdd(currentData, newData) {
        return !!currentData && !!newData && currentData.witnessScript === void 0;
      }
      return {
        decode,
        encode,
        check,
        expected,
        canAdd
      };
    }
    exports.makeConverter = makeConverter;
  }
});

// node_modules/bip174/src/lib/converter/index.js
var require_converter = __commonJS({
  "node_modules/bip174/src/lib/converter/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var typeFields_1 = require_typeFields();
    var globalXpub = require_globalXpub();
    var unsignedTx = require_unsignedTx();
    var finalScriptSig = require_finalScriptSig();
    var finalScriptWitness = require_finalScriptWitness();
    var nonWitnessUtxo = require_nonWitnessUtxo();
    var partialSig = require_partialSig();
    var porCommitment = require_porCommitment();
    var sighashType = require_sighashType();
    var tapKeySig = require_tapKeySig();
    var tapLeafScript = require_tapLeafScript();
    var tapMerkleRoot = require_tapMerkleRoot();
    var tapScriptSig = require_tapScriptSig();
    var witnessUtxo = require_witnessUtxo();
    var tapTree = require_tapTree();
    var bip32Derivation = require_bip32Derivation();
    var checkPubkey = require_checkPubkey();
    var redeemScript = require_redeemScript();
    var tapBip32Derivation = require_tapBip32Derivation();
    var tapInternalKey = require_tapInternalKey();
    var witnessScript = require_witnessScript();
    var globals = {
      unsignedTx,
      globalXpub,
      // pass an Array of key bytes that require pubkey beside the key
      checkPubkey: checkPubkey.makeChecker([])
    };
    exports.globals = globals;
    var inputs = {
      nonWitnessUtxo,
      partialSig,
      sighashType,
      finalScriptSig,
      finalScriptWitness,
      porCommitment,
      witnessUtxo,
      bip32Derivation: bip32Derivation.makeConverter(
        typeFields_1.InputTypes.BIP32_DERIVATION
      ),
      redeemScript: redeemScript.makeConverter(
        typeFields_1.InputTypes.REDEEM_SCRIPT
      ),
      witnessScript: witnessScript.makeConverter(
        typeFields_1.InputTypes.WITNESS_SCRIPT
      ),
      checkPubkey: checkPubkey.makeChecker([
        typeFields_1.InputTypes.PARTIAL_SIG,
        typeFields_1.InputTypes.BIP32_DERIVATION
      ]),
      tapKeySig,
      tapScriptSig,
      tapLeafScript,
      tapBip32Derivation: tapBip32Derivation.makeConverter(
        typeFields_1.InputTypes.TAP_BIP32_DERIVATION
      ),
      tapInternalKey: tapInternalKey.makeConverter(
        typeFields_1.InputTypes.TAP_INTERNAL_KEY
      ),
      tapMerkleRoot
    };
    exports.inputs = inputs;
    var outputs = {
      bip32Derivation: bip32Derivation.makeConverter(
        typeFields_1.OutputTypes.BIP32_DERIVATION
      ),
      redeemScript: redeemScript.makeConverter(
        typeFields_1.OutputTypes.REDEEM_SCRIPT
      ),
      witnessScript: witnessScript.makeConverter(
        typeFields_1.OutputTypes.WITNESS_SCRIPT
      ),
      checkPubkey: checkPubkey.makeChecker([
        typeFields_1.OutputTypes.BIP32_DERIVATION
      ]),
      tapBip32Derivation: tapBip32Derivation.makeConverter(
        typeFields_1.OutputTypes.TAP_BIP32_DERIVATION
      ),
      tapTree,
      tapInternalKey: tapInternalKey.makeConverter(
        typeFields_1.OutputTypes.TAP_INTERNAL_KEY
      )
    };
    exports.outputs = outputs;
  }
});

// node_modules/bip174/src/lib/parser/fromBuffer.js
var require_fromBuffer = __commonJS({
  "node_modules/bip174/src/lib/parser/fromBuffer.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var convert = require_converter();
    var tools_1 = require_tools();
    var varuint = require_varint();
    var typeFields_1 = require_typeFields();
    function psbtFromBuffer(buffer, txGetter) {
      let offset = 0;
      function varSlice() {
        const keyLen = varuint.decode(buffer, offset);
        offset += varuint.encodingLength(keyLen);
        const key = buffer.slice(offset, offset + keyLen);
        offset += keyLen;
        return key;
      }
      function readUInt32BE() {
        const num = buffer.readUInt32BE(offset);
        offset += 4;
        return num;
      }
      function readUInt8() {
        const num = buffer.readUInt8(offset);
        offset += 1;
        return num;
      }
      function getKeyValue() {
        const key = varSlice();
        const value = varSlice();
        return {
          key,
          value
        };
      }
      function checkEndOfKeyValPairs() {
        if (offset >= buffer.length) {
          throw new Error("Format Error: Unexpected End of PSBT");
        }
        const isEnd = buffer.readUInt8(offset) === 0;
        if (isEnd) {
          offset++;
        }
        return isEnd;
      }
      if (readUInt32BE() !== 1886610036) {
        throw new Error("Format Error: Invalid Magic Number");
      }
      if (readUInt8() !== 255) {
        throw new Error(
          "Format Error: Magic Number must be followed by 0xff separator"
        );
      }
      const globalMapKeyVals = [];
      const globalKeyIndex = {};
      while (!checkEndOfKeyValPairs()) {
        const keyVal = getKeyValue();
        const hexKey = keyVal.key.toString("hex");
        if (globalKeyIndex[hexKey]) {
          throw new Error(
            "Format Error: Keys must be unique for global keymap: key " + hexKey
          );
        }
        globalKeyIndex[hexKey] = 1;
        globalMapKeyVals.push(keyVal);
      }
      const unsignedTxMaps = globalMapKeyVals.filter(
        (keyVal) => keyVal.key[0] === typeFields_1.GlobalTypes.UNSIGNED_TX
      );
      if (unsignedTxMaps.length !== 1) {
        throw new Error("Format Error: Only one UNSIGNED_TX allowed");
      }
      const unsignedTx = txGetter(unsignedTxMaps[0].value);
      const { inputCount, outputCount } = unsignedTx.getInputOutputCounts();
      const inputKeyVals = [];
      const outputKeyVals = [];
      for (const index of tools_1.range(inputCount)) {
        const inputKeyIndex = {};
        const input = [];
        while (!checkEndOfKeyValPairs()) {
          const keyVal = getKeyValue();
          const hexKey = keyVal.key.toString("hex");
          if (inputKeyIndex[hexKey]) {
            throw new Error(
              "Format Error: Keys must be unique for each input: input index " + index + " key " + hexKey
            );
          }
          inputKeyIndex[hexKey] = 1;
          input.push(keyVal);
        }
        inputKeyVals.push(input);
      }
      for (const index of tools_1.range(outputCount)) {
        const outputKeyIndex = {};
        const output = [];
        while (!checkEndOfKeyValPairs()) {
          const keyVal = getKeyValue();
          const hexKey = keyVal.key.toString("hex");
          if (outputKeyIndex[hexKey]) {
            throw new Error(
              "Format Error: Keys must be unique for each output: output index " + index + " key " + hexKey
            );
          }
          outputKeyIndex[hexKey] = 1;
          output.push(keyVal);
        }
        outputKeyVals.push(output);
      }
      return psbtFromKeyVals(unsignedTx, {
        globalMapKeyVals,
        inputKeyVals,
        outputKeyVals
      });
    }
    exports.psbtFromBuffer = psbtFromBuffer;
    function checkKeyBuffer(type, keyBuf, keyNum) {
      if (!keyBuf.equals(Buffer2.from([keyNum]))) {
        throw new Error(
          `Format Error: Invalid ${type} key: ${keyBuf.toString("hex")}`
        );
      }
    }
    exports.checkKeyBuffer = checkKeyBuffer;
    function psbtFromKeyVals(unsignedTx, { globalMapKeyVals, inputKeyVals, outputKeyVals }) {
      const globalMap = {
        unsignedTx
      };
      let txCount = 0;
      for (const keyVal of globalMapKeyVals) {
        switch (keyVal.key[0]) {
          case typeFields_1.GlobalTypes.UNSIGNED_TX:
            checkKeyBuffer(
              "global",
              keyVal.key,
              typeFields_1.GlobalTypes.UNSIGNED_TX
            );
            if (txCount > 0) {
              throw new Error("Format Error: GlobalMap has multiple UNSIGNED_TX");
            }
            txCount++;
            break;
          case typeFields_1.GlobalTypes.GLOBAL_XPUB:
            if (globalMap.globalXpub === void 0) {
              globalMap.globalXpub = [];
            }
            globalMap.globalXpub.push(convert.globals.globalXpub.decode(keyVal));
            break;
          default:
            if (!globalMap.unknownKeyVals) globalMap.unknownKeyVals = [];
            globalMap.unknownKeyVals.push(keyVal);
        }
      }
      const inputCount = inputKeyVals.length;
      const outputCount = outputKeyVals.length;
      const inputs = [];
      const outputs = [];
      for (const index of tools_1.range(inputCount)) {
        const input = {};
        for (const keyVal of inputKeyVals[index]) {
          convert.inputs.checkPubkey(keyVal);
          switch (keyVal.key[0]) {
            case typeFields_1.InputTypes.NON_WITNESS_UTXO:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.NON_WITNESS_UTXO
              );
              if (input.nonWitnessUtxo !== void 0) {
                throw new Error(
                  "Format Error: Input has multiple NON_WITNESS_UTXO"
                );
              }
              input.nonWitnessUtxo = convert.inputs.nonWitnessUtxo.decode(keyVal);
              break;
            case typeFields_1.InputTypes.WITNESS_UTXO:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.WITNESS_UTXO
              );
              if (input.witnessUtxo !== void 0) {
                throw new Error("Format Error: Input has multiple WITNESS_UTXO");
              }
              input.witnessUtxo = convert.inputs.witnessUtxo.decode(keyVal);
              break;
            case typeFields_1.InputTypes.PARTIAL_SIG:
              if (input.partialSig === void 0) {
                input.partialSig = [];
              }
              input.partialSig.push(convert.inputs.partialSig.decode(keyVal));
              break;
            case typeFields_1.InputTypes.SIGHASH_TYPE:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.SIGHASH_TYPE
              );
              if (input.sighashType !== void 0) {
                throw new Error("Format Error: Input has multiple SIGHASH_TYPE");
              }
              input.sighashType = convert.inputs.sighashType.decode(keyVal);
              break;
            case typeFields_1.InputTypes.REDEEM_SCRIPT:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.REDEEM_SCRIPT
              );
              if (input.redeemScript !== void 0) {
                throw new Error("Format Error: Input has multiple REDEEM_SCRIPT");
              }
              input.redeemScript = convert.inputs.redeemScript.decode(keyVal);
              break;
            case typeFields_1.InputTypes.WITNESS_SCRIPT:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.WITNESS_SCRIPT
              );
              if (input.witnessScript !== void 0) {
                throw new Error("Format Error: Input has multiple WITNESS_SCRIPT");
              }
              input.witnessScript = convert.inputs.witnessScript.decode(keyVal);
              break;
            case typeFields_1.InputTypes.BIP32_DERIVATION:
              if (input.bip32Derivation === void 0) {
                input.bip32Derivation = [];
              }
              input.bip32Derivation.push(
                convert.inputs.bip32Derivation.decode(keyVal)
              );
              break;
            case typeFields_1.InputTypes.FINAL_SCRIPTSIG:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.FINAL_SCRIPTSIG
              );
              input.finalScriptSig = convert.inputs.finalScriptSig.decode(keyVal);
              break;
            case typeFields_1.InputTypes.FINAL_SCRIPTWITNESS:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.FINAL_SCRIPTWITNESS
              );
              input.finalScriptWitness = convert.inputs.finalScriptWitness.decode(
                keyVal
              );
              break;
            case typeFields_1.InputTypes.POR_COMMITMENT:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.POR_COMMITMENT
              );
              input.porCommitment = convert.inputs.porCommitment.decode(keyVal);
              break;
            case typeFields_1.InputTypes.TAP_KEY_SIG:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.TAP_KEY_SIG
              );
              input.tapKeySig = convert.inputs.tapKeySig.decode(keyVal);
              break;
            case typeFields_1.InputTypes.TAP_SCRIPT_SIG:
              if (input.tapScriptSig === void 0) {
                input.tapScriptSig = [];
              }
              input.tapScriptSig.push(convert.inputs.tapScriptSig.decode(keyVal));
              break;
            case typeFields_1.InputTypes.TAP_LEAF_SCRIPT:
              if (input.tapLeafScript === void 0) {
                input.tapLeafScript = [];
              }
              input.tapLeafScript.push(convert.inputs.tapLeafScript.decode(keyVal));
              break;
            case typeFields_1.InputTypes.TAP_BIP32_DERIVATION:
              if (input.tapBip32Derivation === void 0) {
                input.tapBip32Derivation = [];
              }
              input.tapBip32Derivation.push(
                convert.inputs.tapBip32Derivation.decode(keyVal)
              );
              break;
            case typeFields_1.InputTypes.TAP_INTERNAL_KEY:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.TAP_INTERNAL_KEY
              );
              input.tapInternalKey = convert.inputs.tapInternalKey.decode(keyVal);
              break;
            case typeFields_1.InputTypes.TAP_MERKLE_ROOT:
              checkKeyBuffer(
                "input",
                keyVal.key,
                typeFields_1.InputTypes.TAP_MERKLE_ROOT
              );
              input.tapMerkleRoot = convert.inputs.tapMerkleRoot.decode(keyVal);
              break;
            default:
              if (!input.unknownKeyVals) input.unknownKeyVals = [];
              input.unknownKeyVals.push(keyVal);
          }
        }
        inputs.push(input);
      }
      for (const index of tools_1.range(outputCount)) {
        const output = {};
        for (const keyVal of outputKeyVals[index]) {
          convert.outputs.checkPubkey(keyVal);
          switch (keyVal.key[0]) {
            case typeFields_1.OutputTypes.REDEEM_SCRIPT:
              checkKeyBuffer(
                "output",
                keyVal.key,
                typeFields_1.OutputTypes.REDEEM_SCRIPT
              );
              if (output.redeemScript !== void 0) {
                throw new Error("Format Error: Output has multiple REDEEM_SCRIPT");
              }
              output.redeemScript = convert.outputs.redeemScript.decode(keyVal);
              break;
            case typeFields_1.OutputTypes.WITNESS_SCRIPT:
              checkKeyBuffer(
                "output",
                keyVal.key,
                typeFields_1.OutputTypes.WITNESS_SCRIPT
              );
              if (output.witnessScript !== void 0) {
                throw new Error("Format Error: Output has multiple WITNESS_SCRIPT");
              }
              output.witnessScript = convert.outputs.witnessScript.decode(keyVal);
              break;
            case typeFields_1.OutputTypes.BIP32_DERIVATION:
              if (output.bip32Derivation === void 0) {
                output.bip32Derivation = [];
              }
              output.bip32Derivation.push(
                convert.outputs.bip32Derivation.decode(keyVal)
              );
              break;
            case typeFields_1.OutputTypes.TAP_INTERNAL_KEY:
              checkKeyBuffer(
                "output",
                keyVal.key,
                typeFields_1.OutputTypes.TAP_INTERNAL_KEY
              );
              output.tapInternalKey = convert.outputs.tapInternalKey.decode(keyVal);
              break;
            case typeFields_1.OutputTypes.TAP_TREE:
              checkKeyBuffer(
                "output",
                keyVal.key,
                typeFields_1.OutputTypes.TAP_TREE
              );
              output.tapTree = convert.outputs.tapTree.decode(keyVal);
              break;
            case typeFields_1.OutputTypes.TAP_BIP32_DERIVATION:
              if (output.tapBip32Derivation === void 0) {
                output.tapBip32Derivation = [];
              }
              output.tapBip32Derivation.push(
                convert.outputs.tapBip32Derivation.decode(keyVal)
              );
              break;
            default:
              if (!output.unknownKeyVals) output.unknownKeyVals = [];
              output.unknownKeyVals.push(keyVal);
          }
        }
        outputs.push(output);
      }
      return { globalMap, inputs, outputs };
    }
    exports.psbtFromKeyVals = psbtFromKeyVals;
  }
});

// node_modules/bip174/src/lib/parser/toBuffer.js
var require_toBuffer = __commonJS({
  "node_modules/bip174/src/lib/parser/toBuffer.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var convert = require_converter();
    var tools_1 = require_tools();
    function psbtToBuffer({ globalMap, inputs, outputs }) {
      const { globalKeyVals, inputKeyVals, outputKeyVals } = psbtToKeyVals({
        globalMap,
        inputs,
        outputs
      });
      const globalBuffer = tools_1.keyValsToBuffer(globalKeyVals);
      const keyValsOrEmptyToBuffer = (keyVals) => keyVals.length === 0 ? [Buffer2.from([0])] : keyVals.map(tools_1.keyValsToBuffer);
      const inputBuffers = keyValsOrEmptyToBuffer(inputKeyVals);
      const outputBuffers = keyValsOrEmptyToBuffer(outputKeyVals);
      const header = Buffer2.allocUnsafe(5);
      header.writeUIntBE(482972169471, 0, 5);
      return Buffer2.concat(
        [header, globalBuffer].concat(inputBuffers, outputBuffers)
      );
    }
    exports.psbtToBuffer = psbtToBuffer;
    var sortKeyVals = (a, b) => {
      return a.key.compare(b.key);
    };
    function keyValsFromMap(keyValMap, converterFactory) {
      const keyHexSet = /* @__PURE__ */ new Set();
      const keyVals = Object.entries(keyValMap).reduce((result, [key, value]) => {
        if (key === "unknownKeyVals") return result;
        const converter = converterFactory[key];
        if (converter === void 0) return result;
        const encodedKeyVals = (Array.isArray(value) ? value : [value]).map(
          converter.encode
        );
        const keyHexes = encodedKeyVals.map((kv) => kv.key.toString("hex"));
        keyHexes.forEach((hex) => {
          if (keyHexSet.has(hex))
            throw new Error("Serialize Error: Duplicate key: " + hex);
          keyHexSet.add(hex);
        });
        return result.concat(encodedKeyVals);
      }, []);
      const otherKeyVals = keyValMap.unknownKeyVals ? keyValMap.unknownKeyVals.filter((keyVal) => {
        return !keyHexSet.has(keyVal.key.toString("hex"));
      }) : [];
      return keyVals.concat(otherKeyVals).sort(sortKeyVals);
    }
    function psbtToKeyVals({ globalMap, inputs, outputs }) {
      return {
        globalKeyVals: keyValsFromMap(globalMap, convert.globals),
        inputKeyVals: inputs.map((i) => keyValsFromMap(i, convert.inputs)),
        outputKeyVals: outputs.map((o) => keyValsFromMap(o, convert.outputs))
      };
    }
    exports.psbtToKeyVals = psbtToKeyVals;
  }
});

// node_modules/bip174/src/lib/parser/index.js
var require_parser = __commonJS({
  "node_modules/bip174/src/lib/parser/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    function __export(m) {
      for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    __export(require_fromBuffer());
    __export(require_toBuffer());
  }
});

// node_modules/bip174/src/lib/combiner/index.js
var require_combiner = __commonJS({
  "node_modules/bip174/src/lib/combiner/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var parser_1 = require_parser();
    function combine(psbts) {
      const self2 = psbts[0];
      const selfKeyVals = parser_1.psbtToKeyVals(self2);
      const others = psbts.slice(1);
      if (others.length === 0) throw new Error("Combine: Nothing to combine");
      const selfTx = getTx(self2);
      if (selfTx === void 0) {
        throw new Error("Combine: Self missing transaction");
      }
      const selfGlobalSet = getKeySet(selfKeyVals.globalKeyVals);
      const selfInputSets = selfKeyVals.inputKeyVals.map(getKeySet);
      const selfOutputSets = selfKeyVals.outputKeyVals.map(getKeySet);
      for (const other of others) {
        const otherTx = getTx(other);
        if (otherTx === void 0 || !otherTx.toBuffer().equals(selfTx.toBuffer())) {
          throw new Error(
            "Combine: One of the Psbts does not have the same transaction."
          );
        }
        const otherKeyVals = parser_1.psbtToKeyVals(other);
        const otherGlobalSet = getKeySet(otherKeyVals.globalKeyVals);
        otherGlobalSet.forEach(
          keyPusher(
            selfGlobalSet,
            selfKeyVals.globalKeyVals,
            otherKeyVals.globalKeyVals
          )
        );
        const otherInputSets = otherKeyVals.inputKeyVals.map(getKeySet);
        otherInputSets.forEach(
          (inputSet, idx) => inputSet.forEach(
            keyPusher(
              selfInputSets[idx],
              selfKeyVals.inputKeyVals[idx],
              otherKeyVals.inputKeyVals[idx]
            )
          )
        );
        const otherOutputSets = otherKeyVals.outputKeyVals.map(getKeySet);
        otherOutputSets.forEach(
          (outputSet, idx) => outputSet.forEach(
            keyPusher(
              selfOutputSets[idx],
              selfKeyVals.outputKeyVals[idx],
              otherKeyVals.outputKeyVals[idx]
            )
          )
        );
      }
      return parser_1.psbtFromKeyVals(selfTx, {
        globalMapKeyVals: selfKeyVals.globalKeyVals,
        inputKeyVals: selfKeyVals.inputKeyVals,
        outputKeyVals: selfKeyVals.outputKeyVals
      });
    }
    exports.combine = combine;
    function keyPusher(selfSet, selfKeyVals, otherKeyVals) {
      return (key) => {
        if (selfSet.has(key)) return;
        const newKv = otherKeyVals.filter((kv) => kv.key.toString("hex") === key)[0];
        selfKeyVals.push(newKv);
        selfSet.add(key);
      };
    }
    function getTx(psbt) {
      return psbt.globalMap.unsignedTx;
    }
    function getKeySet(keyVals) {
      const set = /* @__PURE__ */ new Set();
      keyVals.forEach((keyVal) => {
        const hex = keyVal.key.toString("hex");
        if (set.has(hex))
          throw new Error("Combine: KeyValue Map keys should be unique");
        set.add(hex);
      });
      return set;
    }
  }
});

// node_modules/bip174/src/lib/utils.js
var require_utils3 = __commonJS({
  "node_modules/bip174/src/lib/utils.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var converter = require_converter();
    function checkForInput(inputs, inputIndex) {
      const input = inputs[inputIndex];
      if (input === void 0) throw new Error(`No input #${inputIndex}`);
      return input;
    }
    exports.checkForInput = checkForInput;
    function checkForOutput(outputs, outputIndex) {
      const output = outputs[outputIndex];
      if (output === void 0) throw new Error(`No output #${outputIndex}`);
      return output;
    }
    exports.checkForOutput = checkForOutput;
    function checkHasKey(checkKeyVal, keyVals, enumLength) {
      if (checkKeyVal.key[0] < enumLength) {
        throw new Error(
          `Use the method for your specific key instead of addUnknownKeyVal*`
        );
      }
      if (keyVals && keyVals.filter((kv) => kv.key.equals(checkKeyVal.key)).length !== 0) {
        throw new Error(`Duplicate Key: ${checkKeyVal.key.toString("hex")}`);
      }
    }
    exports.checkHasKey = checkHasKey;
    function getEnumLength(myenum) {
      let count = 0;
      Object.keys(myenum).forEach((val) => {
        if (Number(isNaN(Number(val)))) {
          count++;
        }
      });
      return count;
    }
    exports.getEnumLength = getEnumLength;
    function inputCheckUncleanFinalized(inputIndex, input) {
      let result = false;
      if (input.nonWitnessUtxo || input.witnessUtxo) {
        const needScriptSig = !!input.redeemScript;
        const needWitnessScript = !!input.witnessScript;
        const scriptSigOK = !needScriptSig || !!input.finalScriptSig;
        const witnessScriptOK = !needWitnessScript || !!input.finalScriptWitness;
        const hasOneFinal = !!input.finalScriptSig || !!input.finalScriptWitness;
        result = scriptSigOK && witnessScriptOK && hasOneFinal;
      }
      if (result === false) {
        throw new Error(
          `Input #${inputIndex} has too much or too little data to clean`
        );
      }
    }
    exports.inputCheckUncleanFinalized = inputCheckUncleanFinalized;
    function throwForUpdateMaker(typeName, name, expected, data) {
      throw new Error(
        `Data for ${typeName} key ${name} is incorrect: Expected ${expected} and got ${JSON.stringify(data)}`
      );
    }
    function updateMaker(typeName) {
      return (updateData, mainData) => {
        for (const name of Object.keys(updateData)) {
          const data = updateData[name];
          const { canAdd, canAddToArray, check, expected } = (
            // @ts-ignore
            converter[typeName + "s"][name] || {}
          );
          const isArray = !!canAddToArray;
          if (check) {
            if (isArray) {
              if (!Array.isArray(data) || // @ts-ignore
              mainData[name] && !Array.isArray(mainData[name])) {
                throw new Error(`Key type ${name} must be an array`);
              }
              if (!data.every(check)) {
                throwForUpdateMaker(typeName, name, expected, data);
              }
              const arr = mainData[name] || [];
              const dupeCheckSet = /* @__PURE__ */ new Set();
              if (!data.every((v) => canAddToArray(arr, v, dupeCheckSet))) {
                throw new Error("Can not add duplicate data to array");
              }
              mainData[name] = arr.concat(data);
            } else {
              if (!check(data)) {
                throwForUpdateMaker(typeName, name, expected, data);
              }
              if (!canAdd(mainData, data)) {
                throw new Error(`Can not add duplicate data to ${typeName}`);
              }
              mainData[name] = data;
            }
          }
        }
      };
    }
    exports.updateGlobal = updateMaker("global");
    exports.updateInput = updateMaker("input");
    exports.updateOutput = updateMaker("output");
    function addInputAttributes(inputs, data) {
      const index = inputs.length - 1;
      const input = checkForInput(inputs, index);
      exports.updateInput(data, input);
    }
    exports.addInputAttributes = addInputAttributes;
    function addOutputAttributes(outputs, data) {
      const index = outputs.length - 1;
      const output = checkForOutput(outputs, index);
      exports.updateOutput(data, output);
    }
    exports.addOutputAttributes = addOutputAttributes;
    function defaultVersionSetter(version, txBuf) {
      if (!Buffer2.isBuffer(txBuf) || txBuf.length < 4) {
        throw new Error("Set Version: Invalid Transaction");
      }
      txBuf.writeUInt32LE(version, 0);
      return txBuf;
    }
    exports.defaultVersionSetter = defaultVersionSetter;
    function defaultLocktimeSetter(locktime, txBuf) {
      if (!Buffer2.isBuffer(txBuf) || txBuf.length < 4) {
        throw new Error("Set Locktime: Invalid Transaction");
      }
      txBuf.writeUInt32LE(locktime, txBuf.length - 4);
      return txBuf;
    }
    exports.defaultLocktimeSetter = defaultLocktimeSetter;
  }
});

// node_modules/bip174/src/lib/psbt.js
var require_psbt = __commonJS({
  "node_modules/bip174/src/lib/psbt.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    var combiner_1 = require_combiner();
    var parser_1 = require_parser();
    var typeFields_1 = require_typeFields();
    var utils_1 = require_utils3();
    var Psbt2 = class {
      constructor(tx) {
        this.inputs = [];
        this.outputs = [];
        this.globalMap = {
          unsignedTx: tx
        };
      }
      static fromBase64(data, txFromBuffer) {
        const buffer = Buffer2.from(data, "base64");
        return this.fromBuffer(buffer, txFromBuffer);
      }
      static fromHex(data, txFromBuffer) {
        const buffer = Buffer2.from(data, "hex");
        return this.fromBuffer(buffer, txFromBuffer);
      }
      static fromBuffer(buffer, txFromBuffer) {
        const results = parser_1.psbtFromBuffer(buffer, txFromBuffer);
        const psbt = new this(results.globalMap.unsignedTx);
        Object.assign(psbt, results);
        return psbt;
      }
      toBase64() {
        const buffer = this.toBuffer();
        return buffer.toString("base64");
      }
      toHex() {
        const buffer = this.toBuffer();
        return buffer.toString("hex");
      }
      toBuffer() {
        return parser_1.psbtToBuffer(this);
      }
      updateGlobal(updateData) {
        utils_1.updateGlobal(updateData, this.globalMap);
        return this;
      }
      updateInput(inputIndex, updateData) {
        const input = utils_1.checkForInput(this.inputs, inputIndex);
        utils_1.updateInput(updateData, input);
        return this;
      }
      updateOutput(outputIndex, updateData) {
        const output = utils_1.checkForOutput(this.outputs, outputIndex);
        utils_1.updateOutput(updateData, output);
        return this;
      }
      addUnknownKeyValToGlobal(keyVal) {
        utils_1.checkHasKey(
          keyVal,
          this.globalMap.unknownKeyVals,
          utils_1.getEnumLength(typeFields_1.GlobalTypes)
        );
        if (!this.globalMap.unknownKeyVals) this.globalMap.unknownKeyVals = [];
        this.globalMap.unknownKeyVals.push(keyVal);
        return this;
      }
      addUnknownKeyValToInput(inputIndex, keyVal) {
        const input = utils_1.checkForInput(this.inputs, inputIndex);
        utils_1.checkHasKey(
          keyVal,
          input.unknownKeyVals,
          utils_1.getEnumLength(typeFields_1.InputTypes)
        );
        if (!input.unknownKeyVals) input.unknownKeyVals = [];
        input.unknownKeyVals.push(keyVal);
        return this;
      }
      addUnknownKeyValToOutput(outputIndex, keyVal) {
        const output = utils_1.checkForOutput(this.outputs, outputIndex);
        utils_1.checkHasKey(
          keyVal,
          output.unknownKeyVals,
          utils_1.getEnumLength(typeFields_1.OutputTypes)
        );
        if (!output.unknownKeyVals) output.unknownKeyVals = [];
        output.unknownKeyVals.push(keyVal);
        return this;
      }
      addInput(inputData) {
        this.globalMap.unsignedTx.addInput(inputData);
        this.inputs.push({
          unknownKeyVals: []
        });
        const addKeyVals = inputData.unknownKeyVals || [];
        const inputIndex = this.inputs.length - 1;
        if (!Array.isArray(addKeyVals)) {
          throw new Error("unknownKeyVals must be an Array");
        }
        addKeyVals.forEach(
          (keyVal) => this.addUnknownKeyValToInput(inputIndex, keyVal)
        );
        utils_1.addInputAttributes(this.inputs, inputData);
        return this;
      }
      addOutput(outputData) {
        this.globalMap.unsignedTx.addOutput(outputData);
        this.outputs.push({
          unknownKeyVals: []
        });
        const addKeyVals = outputData.unknownKeyVals || [];
        const outputIndex = this.outputs.length - 1;
        if (!Array.isArray(addKeyVals)) {
          throw new Error("unknownKeyVals must be an Array");
        }
        addKeyVals.forEach(
          (keyVal) => this.addUnknownKeyValToOutput(outputIndex, keyVal)
        );
        utils_1.addOutputAttributes(this.outputs, outputData);
        return this;
      }
      clearFinalizedInput(inputIndex) {
        const input = utils_1.checkForInput(this.inputs, inputIndex);
        utils_1.inputCheckUncleanFinalized(inputIndex, input);
        for (const key of Object.keys(input)) {
          if (![
            "witnessUtxo",
            "nonWitnessUtxo",
            "finalScriptSig",
            "finalScriptWitness",
            "unknownKeyVals"
          ].includes(key)) {
            delete input[key];
          }
        }
        return this;
      }
      combine(...those) {
        const result = combiner_1.combine([this].concat(those));
        Object.assign(this, result);
        return this;
      }
      getTransaction() {
        return this.globalMap.unsignedTx.toBuffer();
      }
    };
    exports.Psbt = Psbt2;
  }
});

// node_modules/belcoinjs-lib/src/psbt/psbtutils.js
var require_psbtutils = __commonJS({
  "node_modules/belcoinjs-lib/src/psbt/psbtutils.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.signatureBlocksAction = exports.checkInputForSig = exports.pubkeyInScript = exports.pubkeyPositionInScript = exports.witnessStackToScriptWitness = exports.isP2TR = exports.isP2SHScript = exports.isP2WSHScript = exports.isP2WPKH = exports.isP2PKH = exports.isP2PK = exports.isP2MS = void 0;
    var varuint = require_varint();
    var bscript2 = require_script();
    var transaction_1 = require_transaction();
    var crypto_1 = require_crypto2();
    var payments3 = require_payments();
    function isPaymentFactory(payment) {
      return (script) => {
        try {
          payment({ output: script });
          return true;
        } catch (err) {
          return false;
        }
      };
    }
    exports.isP2MS = isPaymentFactory(payments3.p2ms);
    exports.isP2PK = isPaymentFactory(payments3.p2pk);
    exports.isP2PKH = isPaymentFactory(payments3.p2pkh);
    exports.isP2WPKH = isPaymentFactory(payments3.p2wpkh);
    exports.isP2WSHScript = isPaymentFactory(payments3.p2wsh);
    exports.isP2SHScript = isPaymentFactory(payments3.p2sh);
    exports.isP2TR = isPaymentFactory(payments3.p2tr);
    function witnessStackToScriptWitness(witness) {
      let buffer = Buffer2.allocUnsafe(0);
      function writeSlice(slice) {
        buffer = Buffer2.concat([buffer, Buffer2.from(slice)]);
      }
      function writeVarInt(i) {
        const currentLen = buffer.length;
        const varintLen = varuint.encodingLength(i);
        buffer = Buffer2.concat([buffer, Buffer2.allocUnsafe(varintLen)]);
        varuint.encode(i, buffer, currentLen);
      }
      function writeVarSlice(slice) {
        writeVarInt(slice.length);
        writeSlice(slice);
      }
      function writeVector(vector) {
        writeVarInt(vector.length);
        vector.forEach(writeVarSlice);
      }
      writeVector(witness);
      return buffer;
    }
    exports.witnessStackToScriptWitness = witnessStackToScriptWitness;
    function pubkeyPositionInScript(pubkey, script) {
      const pubkeyHash = (0, crypto_1.hash160)(pubkey);
      const pubkeyXOnly = pubkey.slice(1, 33);
      const decompiled = bscript2.decompile(script);
      if (decompiled === null) throw new Error("Unknown script error");
      return decompiled.findIndex((element) => {
        if (typeof element === "number") return false;
        return element.equals(pubkey) || element.equals(pubkeyHash) || element.equals(pubkeyXOnly);
      });
    }
    exports.pubkeyPositionInScript = pubkeyPositionInScript;
    function pubkeyInScript(pubkey, script) {
      return pubkeyPositionInScript(pubkey, script) !== -1;
    }
    exports.pubkeyInScript = pubkeyInScript;
    function checkInputForSig(input, action) {
      const pSigs = extractPartialSigs(input);
      return pSigs.some(
        (pSig) => signatureBlocksAction(pSig, bscript2.signature.decode, action)
      );
    }
    exports.checkInputForSig = checkInputForSig;
    function signatureBlocksAction(signature, signatureDecodeFn, action) {
      const { hashType } = signatureDecodeFn(signature);
      const whitelist = [];
      const isAnyoneCanPay = hashType & transaction_1.Transaction.SIGHASH_ANYONECANPAY;
      if (isAnyoneCanPay) whitelist.push("addInput");
      const hashMod = hashType & 31;
      switch (hashMod) {
        case transaction_1.Transaction.SIGHASH_ALL:
          break;
        case transaction_1.Transaction.SIGHASH_SINGLE:
        case transaction_1.Transaction.SIGHASH_NONE:
          whitelist.push("addOutput");
          whitelist.push("setInputSequence");
          break;
      }
      if (whitelist.indexOf(action) === -1) {
        return true;
      }
      return false;
    }
    exports.signatureBlocksAction = signatureBlocksAction;
    function extractPartialSigs(input) {
      let pSigs = [];
      if ((input.partialSig || []).length === 0) {
        if (!input.finalScriptSig && !input.finalScriptWitness) return [];
        pSigs = getPsigsFromInputFinalScripts(input);
      } else {
        pSigs = input.partialSig;
      }
      return pSigs.map((p) => p.signature);
    }
    function getPsigsFromInputFinalScripts(input) {
      const scriptItems = !input.finalScriptSig ? [] : bscript2.decompile(input.finalScriptSig) || [];
      const witnessItems = !input.finalScriptWitness ? [] : bscript2.decompile(input.finalScriptWitness) || [];
      return scriptItems.concat(witnessItems).filter((item) => {
        return Buffer2.isBuffer(item) && bscript2.isCanonicalScriptSignature(item);
      }).map((sig) => ({ signature: sig }));
    }
  }
});

// node_modules/belcoinjs-lib/src/psbt/bip371.js
var require_bip371 = __commonJS({
  "node_modules/belcoinjs-lib/src/psbt/bip371.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkTaprootInputForSigs = exports.tapTreeFromList = exports.tapTreeToList = exports.tweakInternalPubKey = exports.checkTaprootOutputFields = exports.checkTaprootInputFields = exports.isTaprootOutput = exports.isTaprootInput = exports.serializeTaprootSignature = exports.tapScriptFinalizer = exports.toXOnly = void 0;
    var types_1 = require_types();
    var transaction_1 = require_transaction();
    var psbtutils_1 = require_psbtutils();
    var bip341_1 = require_bip341();
    var payments_1 = require_payments();
    var psbtutils_2 = require_psbtutils();
    var toXOnly2 = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
    exports.toXOnly = toXOnly2;
    function tapScriptFinalizer(inputIndex, input, tapLeafHashToFinalize) {
      const tapLeaf = findTapLeafToFinalize(
        input,
        inputIndex,
        tapLeafHashToFinalize
      );
      try {
        const sigs = sortSignatures(input, tapLeaf);
        const witness = sigs.concat(tapLeaf.script).concat(tapLeaf.controlBlock);
        return {
          finalScriptWitness: (0, psbtutils_1.witnessStackToScriptWitness)(witness)
        };
      } catch (err) {
        throw new Error(`Can not finalize taproot input #${inputIndex}: ${err}`);
      }
    }
    exports.tapScriptFinalizer = tapScriptFinalizer;
    function serializeTaprootSignature(sig, sighashType) {
      const sighashTypeByte = sighashType ? Buffer2.from([sighashType]) : Buffer2.from([]);
      return Buffer2.concat([sig, sighashTypeByte]);
    }
    exports.serializeTaprootSignature = serializeTaprootSignature;
    function isTaprootInput(input) {
      return input && !!(input.tapInternalKey || input.tapMerkleRoot || input.tapLeafScript && input.tapLeafScript.length || input.tapBip32Derivation && input.tapBip32Derivation.length || input.witnessUtxo && (0, psbtutils_1.isP2TR)(input.witnessUtxo.script));
    }
    exports.isTaprootInput = isTaprootInput;
    function isTaprootOutput(output, script) {
      return output && !!(output.tapInternalKey || output.tapTree || output.tapBip32Derivation && output.tapBip32Derivation.length || script && (0, psbtutils_1.isP2TR)(script));
    }
    exports.isTaprootOutput = isTaprootOutput;
    function checkTaprootInputFields(inputData, newInputData, action) {
      checkMixedTaprootAndNonTaprootInputFields(inputData, newInputData, action);
      checkIfTapLeafInTree(inputData, newInputData, action);
    }
    exports.checkTaprootInputFields = checkTaprootInputFields;
    function checkTaprootOutputFields(outputData, newOutputData, action) {
      checkMixedTaprootAndNonTaprootOutputFields(outputData, newOutputData, action);
      checkTaprootScriptPubkey(outputData, newOutputData);
    }
    exports.checkTaprootOutputFields = checkTaprootOutputFields;
    function checkTaprootScriptPubkey(outputData, newOutputData) {
      if (!newOutputData.tapTree && !newOutputData.tapInternalKey) return;
      const tapInternalKey = newOutputData.tapInternalKey || outputData.tapInternalKey;
      const tapTree = newOutputData.tapTree || outputData.tapTree;
      if (tapInternalKey) {
        const { script: scriptPubkey } = outputData;
        const script = getTaprootScripPubkey(tapInternalKey, tapTree);
        if (scriptPubkey && !scriptPubkey.equals(script))
          throw new Error("Error adding output. Script or address mismatch.");
      }
    }
    function getTaprootScripPubkey(tapInternalKey, tapTree) {
      const scriptTree = tapTree && tapTreeFromList(tapTree.leaves);
      const { output } = (0, payments_1.p2tr)({
        internalPubkey: tapInternalKey,
        scriptTree
      });
      return output;
    }
    function tweakInternalPubKey(inputIndex, input) {
      const tapInternalKey = input.tapInternalKey;
      const outputKey = tapInternalKey && (0, bip341_1.tweakKey)(tapInternalKey, input.tapMerkleRoot);
      if (!outputKey)
        throw new Error(
          `Cannot tweak tap internal key for input #${inputIndex}. Public key: ${tapInternalKey && tapInternalKey.toString("hex")}`
        );
      return outputKey.x;
    }
    exports.tweakInternalPubKey = tweakInternalPubKey;
    function tapTreeToList(tree) {
      if (!(0, types_1.isTaptree)(tree))
        throw new Error(
          "Cannot convert taptree to tapleaf list. Expecting a tapree structure."
        );
      return _tapTreeToList(tree);
    }
    exports.tapTreeToList = tapTreeToList;
    function tapTreeFromList(leaves = []) {
      if (leaves.length === 1 && leaves[0].depth === 0)
        return {
          output: leaves[0].script,
          version: leaves[0].leafVersion
        };
      return instertLeavesInTree(leaves);
    }
    exports.tapTreeFromList = tapTreeFromList;
    function checkTaprootInputForSigs(input, action) {
      const sigs = extractTaprootSigs(input);
      return sigs.some(
        (sig) => (0, psbtutils_2.signatureBlocksAction)(sig, decodeSchnorrSignature, action)
      );
    }
    exports.checkTaprootInputForSigs = checkTaprootInputForSigs;
    function decodeSchnorrSignature(signature) {
      return {
        signature: signature.slice(0, 64),
        hashType: signature.slice(64)[0] || transaction_1.Transaction.SIGHASH_DEFAULT
      };
    }
    function extractTaprootSigs(input) {
      const sigs = [];
      if (input.tapKeySig) sigs.push(input.tapKeySig);
      if (input.tapScriptSig)
        sigs.push(...input.tapScriptSig.map((s) => s.signature));
      if (!sigs.length) {
        const finalTapKeySig = getTapKeySigFromWithness(input.finalScriptWitness);
        if (finalTapKeySig) sigs.push(finalTapKeySig);
      }
      return sigs;
    }
    function getTapKeySigFromWithness(finalScriptWitness) {
      if (!finalScriptWitness) return;
      const witness = finalScriptWitness.slice(2);
      if (witness.length === 64 || witness.length === 65) return witness;
    }
    function _tapTreeToList(tree, leaves = [], depth = 0) {
      if (depth > bip341_1.MAX_TAPTREE_DEPTH)
        throw new Error("Max taptree depth exceeded.");
      if (!tree) return [];
      if ((0, types_1.isTapleaf)(tree)) {
        leaves.push({
          depth,
          leafVersion: tree.version || bip341_1.LEAF_VERSION_TAPSCRIPT,
          script: tree.output
        });
        return leaves;
      }
      if (tree[0]) _tapTreeToList(tree[0], leaves, depth + 1);
      if (tree[1]) _tapTreeToList(tree[1], leaves, depth + 1);
      return leaves;
    }
    function instertLeavesInTree(leaves) {
      let tree;
      for (const leaf of leaves) {
        tree = instertLeafInTree(leaf, tree);
        if (!tree) throw new Error(`No room left to insert tapleaf in tree`);
      }
      return tree;
    }
    function instertLeafInTree(leaf, tree, depth = 0) {
      if (depth > bip341_1.MAX_TAPTREE_DEPTH)
        throw new Error("Max taptree depth exceeded.");
      if (leaf.depth === depth) {
        if (!tree)
          return {
            output: leaf.script,
            version: leaf.leafVersion
          };
        return;
      }
      if ((0, types_1.isTapleaf)(tree)) return;
      const leftSide = instertLeafInTree(leaf, tree && tree[0], depth + 1);
      if (leftSide) return [leftSide, tree && tree[1]];
      const rightSide = instertLeafInTree(leaf, tree && tree[1], depth + 1);
      if (rightSide) return [tree && tree[0], rightSide];
    }
    function checkMixedTaprootAndNonTaprootInputFields(inputData, newInputData, action) {
      const isBadTaprootUpdate = isTaprootInput(inputData) && hasNonTaprootFields(newInputData);
      const isBadNonTaprootUpdate = hasNonTaprootFields(inputData) && isTaprootInput(newInputData);
      const hasMixedFields = inputData === newInputData && isTaprootInput(newInputData) && hasNonTaprootFields(newInputData);
      if (isBadTaprootUpdate || isBadNonTaprootUpdate || hasMixedFields)
        throw new Error(
          `Invalid arguments for Psbt.${action}. Cannot use both taproot and non-taproot fields.`
        );
    }
    function checkMixedTaprootAndNonTaprootOutputFields(inputData, newInputData, action) {
      const isBadTaprootUpdate = isTaprootOutput(inputData) && hasNonTaprootFields(newInputData);
      const isBadNonTaprootUpdate = hasNonTaprootFields(inputData) && isTaprootOutput(newInputData);
      const hasMixedFields = inputData === newInputData && isTaprootOutput(newInputData) && hasNonTaprootFields(newInputData);
      if (isBadTaprootUpdate || isBadNonTaprootUpdate || hasMixedFields)
        throw new Error(
          `Invalid arguments for Psbt.${action}. Cannot use both taproot and non-taproot fields.`
        );
    }
    function checkIfTapLeafInTree(inputData, newInputData, action) {
      if (newInputData.tapMerkleRoot) {
        const newLeafsInTree = (newInputData.tapLeafScript || []).every(
          (l) => isTapLeafInTree(l, newInputData.tapMerkleRoot)
        );
        const oldLeafsInTree = (inputData.tapLeafScript || []).every(
          (l) => isTapLeafInTree(l, newInputData.tapMerkleRoot)
        );
        if (!newLeafsInTree || !oldLeafsInTree)
          throw new Error(
            `Invalid arguments for Psbt.${action}. Tapleaf not part of taptree.`
          );
      } else if (inputData.tapMerkleRoot) {
        const newLeafsInTree = (newInputData.tapLeafScript || []).every(
          (l) => isTapLeafInTree(l, inputData.tapMerkleRoot)
        );
        if (!newLeafsInTree)
          throw new Error(
            `Invalid arguments for Psbt.${action}. Tapleaf not part of taptree.`
          );
      }
    }
    function isTapLeafInTree(tapLeaf, merkleRoot) {
      if (!merkleRoot) return true;
      const leafHash = (0, bip341_1.tapleafHash)({
        output: tapLeaf.script,
        version: tapLeaf.leafVersion
      });
      const rootHash = (0, bip341_1.rootHashFromPath)(
        tapLeaf.controlBlock,
        leafHash
      );
      return rootHash.equals(merkleRoot);
    }
    function sortSignatures(input, tapLeaf) {
      const leafHash = (0, bip341_1.tapleafHash)({
        output: tapLeaf.script,
        version: tapLeaf.leafVersion
      });
      return (input.tapScriptSig || []).filter((tss) => tss.leafHash.equals(leafHash)).map((tss) => addPubkeyPositionInScript(tapLeaf.script, tss)).sort((t1, t2) => t2.positionInScript - t1.positionInScript).map((t) => t.signature);
    }
    function addPubkeyPositionInScript(script, tss) {
      return Object.assign(
        {
          positionInScript: (0, psbtutils_1.pubkeyPositionInScript)(
            tss.pubkey,
            script
          )
        },
        tss
      );
    }
    function findTapLeafToFinalize(input, inputIndex, leafHashToFinalize) {
      if (!input.tapScriptSig || !input.tapScriptSig.length)
        throw new Error(
          `Can not finalize taproot input #${inputIndex}. No tapleaf script signature provided.`
        );
      const tapLeaf = (input.tapLeafScript || []).sort((a, b) => a.controlBlock.length - b.controlBlock.length).find(
        (leaf) => canFinalizeLeaf(leaf, input.tapScriptSig, leafHashToFinalize)
      );
      if (!tapLeaf)
        throw new Error(
          `Can not finalize taproot input #${inputIndex}. Signature for tapleaf script not found.`
        );
      return tapLeaf;
    }
    function canFinalizeLeaf(leaf, tapScriptSig, hash) {
      const leafHash = (0, bip341_1.tapleafHash)({
        output: leaf.script,
        version: leaf.leafVersion
      });
      const whiteListedHash = !hash || hash.equals(leafHash);
      return whiteListedHash && tapScriptSig.find((tss) => tss.leafHash.equals(leafHash)) !== void 0;
    }
    function hasNonTaprootFields(io) {
      return io && !!(io.redeemScript || io.witnessScript || io.bip32Derivation && io.bip32Derivation.length);
    }
  }
});

// node_modules/belcoinjs-lib/src/psbt.js
var require_psbt2 = __commonJS({
  "node_modules/belcoinjs-lib/src/psbt.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Psbt = void 0;
    var bip174_1 = require_psbt();
    var varuint = require_varint();
    var utils_1 = require_utils3();
    var address_1 = require_address();
    var bufferutils_1 = require_bufferutils();
    var networks_1 = require_networks();
    var payments3 = require_payments();
    var bip341_1 = require_bip341();
    var bscript2 = require_script();
    var transaction_1 = require_transaction();
    var bip371_1 = require_bip371();
    var psbtutils_1 = require_psbtutils();
    var DEFAULT_OPTS = {
      /**
       * A bitcoinjs Network object. This is only used if you pass an `address`
       * parameter to addOutput. Otherwise it is not needed and can be left default.
       */
      network: networks_1.bellcoin,
      /**
       * When extractTransaction is called, the fee rate is checked.
       * THIS IS NOT TO BE RELIED ON.
       * It is only here as a last ditch effort to prevent sending a 500 BTC fee etc.
       */
      maximumFeeRate: 5e3
      // satoshi per byte
    };
    var Psbt2 = class _Psbt {
      constructor(opts = {}, data = new bip174_1.Psbt(new PsbtTransaction())) {
        this.data = data;
        this.opts = Object.assign({}, DEFAULT_OPTS, opts);
        this.__CACHE = {
          __NON_WITNESS_UTXO_TX_CACHE: [],
          __NON_WITNESS_UTXO_BUF_CACHE: [],
          __TX_IN_CACHE: {},
          __TX: this.data.globalMap.unsignedTx.tx,
          // Psbt's predecessor (TransactionBuilder - now removed) behavior
          // was to not confirm input values  before signing.
          // Even though we highly encourage people to get
          // the full parent transaction to verify values, the ability to
          // sign non-segwit inputs without the full transaction was often
          // requested. So the only way to activate is to use @ts-ignore.
          // We will disable exporting the Psbt when unsafe sign is active.
          // because it is not BIP174 compliant.
          __UNSAFE_SIGN_NONSEGWIT: false
        };
        if (this.data.inputs.length === 0) this.setVersion(2);
        const dpew = (obj, attr, enumerable, writable) => Object.defineProperty(obj, attr, {
          enumerable,
          writable
        });
        dpew(this, "__CACHE", false, true);
        dpew(this, "opts", false, true);
      }
      static fromBase64(data, opts = {}) {
        const buffer = Buffer2.from(data, "base64");
        return this.fromBuffer(buffer, opts);
      }
      static fromHex(data, opts = {}) {
        const buffer = Buffer2.from(data, "hex");
        return this.fromBuffer(buffer, opts);
      }
      static fromBuffer(buffer, opts = {}) {
        const psbtBase = bip174_1.Psbt.fromBuffer(buffer, transactionFromBuffer);
        const psbt = new _Psbt(opts, psbtBase);
        checkTxForDupeIns(psbt.__CACHE.__TX, psbt.__CACHE);
        return psbt;
      }
      get inputCount() {
        return this.data.inputs.length;
      }
      get version() {
        return this.__CACHE.__TX.version;
      }
      set version(version) {
        this.setVersion(version);
      }
      get locktime() {
        return this.__CACHE.__TX.locktime;
      }
      set locktime(locktime) {
        this.setLocktime(locktime);
      }
      get txInputs() {
        return this.__CACHE.__TX.ins.map((input) => ({
          hash: (0, bufferutils_1.cloneBuffer)(input.hash),
          index: input.index,
          sequence: input.sequence
        }));
      }
      get txOutputs() {
        return this.__CACHE.__TX.outs.map((output) => {
          let address2;
          try {
            address2 = (0, address_1.fromOutputScript)(
              output.script,
              this.opts.network
            );
          } catch (_) {
          }
          return {
            script: (0, bufferutils_1.cloneBuffer)(output.script),
            value: output.value,
            address: address2
          };
        });
      }
      combine(...those) {
        this.data.combine(...those.map((o) => o.data));
        return this;
      }
      clone() {
        const res = _Psbt.fromBuffer(this.data.toBuffer());
        res.opts = JSON.parse(JSON.stringify(this.opts));
        return res;
      }
      setMaximumFeeRate(satoshiPerByte) {
        check32Bit(satoshiPerByte);
        this.opts.maximumFeeRate = satoshiPerByte;
      }
      setVersion(version) {
        check32Bit(version);
        checkInputsForPartialSig(this.data.inputs, "setVersion");
        const c = this.__CACHE;
        c.__TX.version = version;
        c.__EXTRACTED_TX = void 0;
        return this;
      }
      setLocktime(locktime) {
        check32Bit(locktime);
        checkInputsForPartialSig(this.data.inputs, "setLocktime");
        const c = this.__CACHE;
        c.__TX.locktime = locktime;
        c.__EXTRACTED_TX = void 0;
        return this;
      }
      setInputSequence(inputIndex, sequence) {
        check32Bit(sequence);
        checkInputsForPartialSig(this.data.inputs, "setInputSequence");
        const c = this.__CACHE;
        if (c.__TX.ins.length <= inputIndex) {
          throw new Error("Input index too high");
        }
        c.__TX.ins[inputIndex].sequence = sequence;
        c.__EXTRACTED_TX = void 0;
        return this;
      }
      addInputs(inputDatas) {
        inputDatas.forEach((inputData) => this.addInput(inputData));
        return this;
      }
      addInput(inputData) {
        if (arguments.length > 1 || !inputData || inputData.hash === void 0 || inputData.index === void 0) {
          throw new Error(
            `Invalid arguments for Psbt.addInput. Requires single object with at least [hash] and [index]`
          );
        }
        (0, bip371_1.checkTaprootInputFields)(inputData, inputData, "addInput");
        checkInputsForPartialSig(this.data.inputs, "addInput");
        if (inputData.witnessScript) checkInvalidP2WSH(inputData.witnessScript);
        const c = this.__CACHE;
        this.data.addInput(inputData);
        const txIn = c.__TX.ins[c.__TX.ins.length - 1];
        checkTxInputCache(c, txIn);
        const inputIndex = this.data.inputs.length - 1;
        const input = this.data.inputs[inputIndex];
        if (input.nonWitnessUtxo) {
          addNonWitnessTxCache(this.__CACHE, input, inputIndex);
        }
        c.__FEE = void 0;
        c.__FEE_RATE = void 0;
        c.__EXTRACTED_TX = void 0;
        return this;
      }
      addOutputs(outputDatas) {
        outputDatas.forEach((outputData) => this.addOutput(outputData));
        return this;
      }
      addOutput(outputData) {
        if (arguments.length > 1 || !outputData || outputData.value === void 0 || outputData.address === void 0 && outputData.script === void 0) {
          throw new Error(
            `Invalid arguments for Psbt.addOutput. Requires single object with at least [script or address] and [value]`
          );
        }
        checkInputsForPartialSig(this.data.inputs, "addOutput");
        const { address: address2 } = outputData;
        if (typeof address2 === "string") {
          const { network } = this.opts;
          const script = (0, address_1.toOutputScript)(address2, network);
          outputData = Object.assign({}, outputData, { script });
        }
        (0, bip371_1.checkTaprootOutputFields)(outputData, outputData, "addOutput");
        const c = this.__CACHE;
        this.data.addOutput(outputData);
        c.__FEE = void 0;
        c.__FEE_RATE = void 0;
        c.__EXTRACTED_TX = void 0;
        return this;
      }
      extractTransaction(disableFeeCheck) {
        if (!this.data.inputs.every(isFinalized)) throw new Error("Not finalized");
        const c = this.__CACHE;
        if (!disableFeeCheck) {
          checkFees(this, c, this.opts);
        }
        if (c.__EXTRACTED_TX) return c.__EXTRACTED_TX;
        const tx = c.__TX.clone();
        inputFinalizeGetAmts(this.data.inputs, tx, c, true);
        return tx;
      }
      getFeeRate() {
        return getTxCacheValue(
          "__FEE_RATE",
          "fee rate",
          this.data.inputs,
          this.__CACHE
        );
      }
      getFee() {
        return getTxCacheValue("__FEE", "fee", this.data.inputs, this.__CACHE);
      }
      finalizeAllInputs() {
        (0, utils_1.checkForInput)(this.data.inputs, 0);
        range(this.data.inputs.length).forEach((idx) => this.finalizeInput(idx));
        return this;
      }
      finalizeInput(inputIndex, finalScriptsFunc) {
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        if ((0, bip371_1.isTaprootInput)(input))
          return this._finalizeTaprootInput(
            inputIndex,
            input,
            void 0,
            finalScriptsFunc
          );
        return this._finalizeInput(inputIndex, input, finalScriptsFunc);
      }
      finalizeTaprootInput(inputIndex, tapLeafHashToFinalize, finalScriptsFunc = bip371_1.tapScriptFinalizer) {
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        if ((0, bip371_1.isTaprootInput)(input))
          return this._finalizeTaprootInput(
            inputIndex,
            input,
            tapLeafHashToFinalize,
            finalScriptsFunc
          );
        throw new Error(`Cannot finalize input #${inputIndex}. Not Taproot.`);
      }
      _finalizeInput(inputIndex, input, finalScriptsFunc = getFinalScripts) {
        const { script, isP2SH, isP2WSH, isSegwit } = getScriptFromInput(
          inputIndex,
          input,
          this.__CACHE
        );
        if (!script) throw new Error(`No script found for input #${inputIndex}`);
        checkPartialSigSighashes(input);
        const { finalScriptSig, finalScriptWitness } = finalScriptsFunc(
          inputIndex,
          input,
          script,
          isSegwit,
          isP2SH,
          isP2WSH
        );
        if (finalScriptSig) this.data.updateInput(inputIndex, { finalScriptSig });
        if (finalScriptWitness)
          this.data.updateInput(inputIndex, { finalScriptWitness });
        if (!finalScriptSig && !finalScriptWitness)
          throw new Error(`Unknown error finalizing input #${inputIndex}`);
        this.data.clearFinalizedInput(inputIndex);
        return this;
      }
      _finalizeTaprootInput(inputIndex, input, tapLeafHashToFinalize, finalScriptsFunc = bip371_1.tapScriptFinalizer) {
        if (!input.witnessUtxo)
          throw new Error(
            `Cannot finalize input #${inputIndex}. Missing withness utxo.`
          );
        if (input.tapKeySig) {
          const payment = payments3.p2tr({
            output: input.witnessUtxo.script,
            signature: input.tapKeySig
          });
          const finalScriptWitness = (0, psbtutils_1.witnessStackToScriptWitness)(
            payment.witness
          );
          this.data.updateInput(inputIndex, { finalScriptWitness });
        } else {
          const { finalScriptWitness } = finalScriptsFunc(
            inputIndex,
            input,
            tapLeafHashToFinalize
          );
          this.data.updateInput(inputIndex, { finalScriptWitness });
        }
        this.data.clearFinalizedInput(inputIndex);
        return this;
      }
      getInputType(inputIndex) {
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        const script = getScriptFromUtxo(inputIndex, input, this.__CACHE);
        const result = getMeaningfulScript(
          script,
          inputIndex,
          "input",
          input.redeemScript || redeemFromFinalScriptSig(input.finalScriptSig),
          input.witnessScript || redeemFromFinalWitnessScript(input.finalScriptWitness)
        );
        const type = result.type === "raw" ? "" : result.type + "-";
        const mainType = classifyScript(result.meaningfulScript);
        return type + mainType;
      }
      inputHasPubkey(inputIndex, pubkey) {
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        return pubkeyInInput(pubkey, input, inputIndex, this.__CACHE);
      }
      inputHasHDKey(inputIndex, root) {
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        const derivationIsMine = bip32DerivationIsMine(root);
        return !!input.bip32Derivation && input.bip32Derivation.some(derivationIsMine);
      }
      outputHasPubkey(outputIndex, pubkey) {
        const output = (0, utils_1.checkForOutput)(this.data.outputs, outputIndex);
        return pubkeyInOutput(pubkey, output, outputIndex, this.__CACHE);
      }
      outputHasHDKey(outputIndex, root) {
        const output = (0, utils_1.checkForOutput)(this.data.outputs, outputIndex);
        const derivationIsMine = bip32DerivationIsMine(root);
        return !!output.bip32Derivation && output.bip32Derivation.some(derivationIsMine);
      }
      validateSignaturesOfAllInputs(validator) {
        (0, utils_1.checkForInput)(this.data.inputs, 0);
        const results = range(this.data.inputs.length).map(
          (idx) => this.validateSignaturesOfInput(idx, validator)
        );
        return results.reduce((final, res) => res === true && final, true);
      }
      validateSignaturesOfInput(inputIndex, validator, pubkey) {
        const input = this.data.inputs[inputIndex];
        if ((0, bip371_1.isTaprootInput)(input))
          return this.validateSignaturesOfTaprootInput(
            inputIndex,
            validator,
            pubkey
          );
        return this._validateSignaturesOfInput(inputIndex, validator, pubkey);
      }
      _validateSignaturesOfInput(inputIndex, validator, pubkey) {
        const input = this.data.inputs[inputIndex];
        const partialSig = (input || {}).partialSig;
        if (!input || !partialSig || partialSig.length < 1)
          throw new Error("No signatures to validate");
        if (typeof validator !== "function")
          throw new Error("Need validator function to validate signatures");
        const mySigs = pubkey ? partialSig.filter((sig) => sig.pubkey.equals(pubkey)) : partialSig;
        if (mySigs.length < 1) throw new Error("No signatures for this pubkey");
        const results = [];
        let hashCache;
        let scriptCache;
        let sighashCache;
        for (const pSig of mySigs) {
          const sig = bscript2.signature.decode(pSig.signature);
          const { hash, script } = sighashCache !== sig.hashType ? getHashForSig(
            inputIndex,
            Object.assign({}, input, { sighashType: sig.hashType }),
            this.__CACHE,
            true
          ) : { hash: hashCache, script: scriptCache };
          sighashCache = sig.hashType;
          hashCache = hash;
          scriptCache = script;
          checkScriptForPubkey(pSig.pubkey, script, "verify");
          results.push(validator(pSig.pubkey, hash, sig.signature));
        }
        return results.every((res) => res === true);
      }
      validateSignaturesOfTaprootInput(inputIndex, validator, pubkey) {
        const input = this.data.inputs[inputIndex];
        const tapKeySig = (input || {}).tapKeySig;
        const tapScriptSig = (input || {}).tapScriptSig;
        if (!input && !tapKeySig && !(tapScriptSig && !tapScriptSig.length))
          throw new Error("No signatures to validate");
        if (typeof validator !== "function")
          throw new Error("Need validator function to validate signatures");
        pubkey = pubkey && (0, bip371_1.toXOnly)(pubkey);
        const allHashses = pubkey ? getTaprootHashesForSig(
          inputIndex,
          input,
          this.data.inputs,
          pubkey,
          this.__CACHE
        ) : getAllTaprootHashesForSig(
          inputIndex,
          input,
          this.data.inputs,
          this.__CACHE
        );
        if (!allHashses.length) throw new Error("No signatures for this pubkey");
        const tapKeyHash = allHashses.find((h) => !h.leafHash);
        let validationResultCount = 0;
        if (tapKeySig && tapKeyHash) {
          const isValidTapkeySig = validator(
            tapKeyHash.pubkey,
            tapKeyHash.hash,
            trimTaprootSig(tapKeySig)
          );
          if (!isValidTapkeySig) return false;
          validationResultCount++;
        }
        if (tapScriptSig) {
          for (const tapSig of tapScriptSig) {
            const tapSigHash = allHashses.find((h) => tapSig.pubkey.equals(h.pubkey));
            if (tapSigHash) {
              const isValidTapScriptSig = validator(
                tapSig.pubkey,
                tapSigHash.hash,
                trimTaprootSig(tapSig.signature)
              );
              if (!isValidTapScriptSig) return false;
              validationResultCount++;
            }
          }
        }
        return validationResultCount > 0;
      }
      signAllInputsHD(hdKeyPair, sighashTypes = [transaction_1.Transaction.SIGHASH_ALL]) {
        if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
          throw new Error("Need HDSigner to sign input");
        }
        const results = [];
        for (const i of range(this.data.inputs.length)) {
          try {
            this.signInputHD(i, hdKeyPair, sighashTypes);
            results.push(true);
          } catch (err) {
            results.push(false);
          }
        }
        if (results.every((v) => v === false)) {
          throw new Error("No inputs were signed");
        }
        return this;
      }
      signAllInputsHDAsync(hdKeyPair, sighashTypes = [transaction_1.Transaction.SIGHASH_ALL]) {
        return new Promise((resolve, reject) => {
          if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
            return reject(new Error("Need HDSigner to sign input"));
          }
          const results = [];
          const promises = [];
          for (const i of range(this.data.inputs.length)) {
            promises.push(
              this.signInputHDAsync(i, hdKeyPair, sighashTypes).then(
                () => {
                  results.push(true);
                },
                () => {
                  results.push(false);
                }
              )
            );
          }
          return Promise.all(promises).then(() => {
            if (results.every((v) => v === false)) {
              return reject(new Error("No inputs were signed"));
            }
            resolve();
          });
        });
      }
      signInputHD(inputIndex, hdKeyPair, sighashTypes = [transaction_1.Transaction.SIGHASH_ALL]) {
        if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
          throw new Error("Need HDSigner to sign input");
        }
        const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair);
        signers.forEach((signer) => this.signInput(inputIndex, signer, sighashTypes));
        return this;
      }
      signInputHDAsync(inputIndex, hdKeyPair, sighashTypes = [transaction_1.Transaction.SIGHASH_ALL]) {
        return new Promise((resolve, reject) => {
          if (!hdKeyPair || !hdKeyPair.publicKey || !hdKeyPair.fingerprint) {
            return reject(new Error("Need HDSigner to sign input"));
          }
          const signers = getSignersFromHD(inputIndex, this.data.inputs, hdKeyPair);
          const promises = signers.map(
            (signer) => this.signInputAsync(inputIndex, signer, sighashTypes)
          );
          return Promise.all(promises).then(() => {
            resolve();
          }).catch(reject);
        });
      }
      signAllInputs(keyPair, sighashTypes) {
        if (!keyPair || !keyPair.publicKey)
          throw new Error("Need Signer to sign input");
        const results = [];
        for (const i of range(this.data.inputs.length)) {
          try {
            this.signInput(i, keyPair, sighashTypes);
            results.push(true);
          } catch (err) {
            results.push(false);
          }
        }
        if (results.every((v) => v === false)) {
          throw new Error("No inputs were signed");
        }
        return this;
      }
      signAllInputsAsync(keyPair, sighashTypes) {
        return new Promise((resolve, reject) => {
          if (!keyPair || !keyPair.publicKey)
            return reject(new Error("Need Signer to sign input"));
          const results = [];
          const promises = [];
          for (const [i] of this.data.inputs.entries()) {
            promises.push(
              this.signInputAsync(i, keyPair, sighashTypes).then(
                () => {
                  results.push(true);
                },
                () => {
                  results.push(false);
                }
              )
            );
          }
          return Promise.all(promises).then(() => {
            if (results.every((v) => v === false)) {
              return reject(new Error("No inputs were signed"));
            }
            resolve();
          });
        });
      }
      signInput(inputIndex, keyPair, sighashTypes) {
        if (!keyPair || !keyPair.publicKey)
          throw new Error("Need Signer to sign input");
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        if ((0, bip371_1.isTaprootInput)(input)) {
          return this._signTaprootInput(
            inputIndex,
            input,
            keyPair,
            void 0,
            sighashTypes
          );
        }
        return this._signInput(inputIndex, keyPair, sighashTypes);
      }
      signTaprootInput(inputIndex, keyPair, tapLeafHashToSign, sighashTypes) {
        if (!keyPair || !keyPair.publicKey)
          throw new Error("Need Signer to sign input");
        const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
        if ((0, bip371_1.isTaprootInput)(input))
          return this._signTaprootInput(
            inputIndex,
            input,
            keyPair,
            tapLeafHashToSign,
            sighashTypes
          );
        throw new Error(`Input #${inputIndex} is not of type Taproot.`);
      }
      _signInput(inputIndex, keyPair, sighashTypes = [transaction_1.Transaction.SIGHASH_ALL]) {
        const { hash, sighashType } = getHashAndSighashType(
          this.data.inputs,
          inputIndex,
          keyPair.publicKey,
          this.__CACHE,
          sighashTypes
        );
        const partialSig = [
          {
            pubkey: keyPair.publicKey,
            signature: bscript2.signature.encode(keyPair.sign(hash), sighashType)
          }
        ];
        this.data.updateInput(inputIndex, { partialSig });
        return this;
      }
      _signTaprootInput(inputIndex, input, keyPair, tapLeafHashToSign, allowedSighashTypes = [transaction_1.Transaction.SIGHASH_DEFAULT]) {
        const hashesForSig = this.checkTaprootHashesForSig(
          inputIndex,
          input,
          keyPair,
          tapLeafHashToSign,
          allowedSighashTypes
        );
        const tapKeySig = hashesForSig.filter((h) => !h.leafHash).map(
          (h) => (0, bip371_1.serializeTaprootSignature)(
            keyPair.signSchnorr(h.hash),
            input.sighashType
          )
        )[0];
        const tapScriptSig = hashesForSig.filter((h) => !!h.leafHash).map((h) => ({
          pubkey: (0, bip371_1.toXOnly)(keyPair.publicKey),
          signature: (0, bip371_1.serializeTaprootSignature)(
            keyPair.signSchnorr(h.hash),
            input.sighashType
          ),
          leafHash: h.leafHash
        }));
        if (tapKeySig) {
          this.data.updateInput(inputIndex, { tapKeySig });
        }
        if (tapScriptSig.length) {
          this.data.updateInput(inputIndex, { tapScriptSig });
        }
        return this;
      }
      signInputAsync(inputIndex, keyPair, sighashTypes) {
        return Promise.resolve().then(() => {
          if (!keyPair || !keyPair.publicKey)
            throw new Error("Need Signer to sign input");
          const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
          if ((0, bip371_1.isTaprootInput)(input))
            return this._signTaprootInputAsync(
              inputIndex,
              input,
              keyPair,
              void 0,
              sighashTypes
            );
          return this._signInputAsync(inputIndex, keyPair, sighashTypes);
        });
      }
      signTaprootInputAsync(inputIndex, keyPair, tapLeafHash, sighashTypes) {
        return Promise.resolve().then(() => {
          if (!keyPair || !keyPair.publicKey)
            throw new Error("Need Signer to sign input");
          const input = (0, utils_1.checkForInput)(this.data.inputs, inputIndex);
          if ((0, bip371_1.isTaprootInput)(input))
            return this._signTaprootInputAsync(
              inputIndex,
              input,
              keyPair,
              tapLeafHash,
              sighashTypes
            );
          throw new Error(`Input #${inputIndex} is not of type Taproot.`);
        });
      }
      _signInputAsync(inputIndex, keyPair, sighashTypes = [transaction_1.Transaction.SIGHASH_ALL]) {
        const { hash, sighashType } = getHashAndSighashType(
          this.data.inputs,
          inputIndex,
          keyPair.publicKey,
          this.__CACHE,
          sighashTypes
        );
        return Promise.resolve(keyPair.sign(hash)).then((signature) => {
          const partialSig = [
            {
              pubkey: keyPair.publicKey,
              signature: bscript2.signature.encode(signature, sighashType)
            }
          ];
          this.data.updateInput(inputIndex, { partialSig });
        });
      }
      async _signTaprootInputAsync(inputIndex, input, keyPair, tapLeafHash, sighashTypes = [transaction_1.Transaction.SIGHASH_DEFAULT]) {
        const hashesForSig = this.checkTaprootHashesForSig(
          inputIndex,
          input,
          keyPair,
          tapLeafHash,
          sighashTypes
        );
        const signaturePromises = [];
        const tapKeyHash = hashesForSig.filter((h) => !h.leafHash)[0];
        if (tapKeyHash) {
          const tapKeySigPromise = Promise.resolve(
            keyPair.signSchnorr(tapKeyHash.hash)
          ).then((sig) => {
            return {
              tapKeySig: (0, bip371_1.serializeTaprootSignature)(
                sig,
                input.sighashType
              )
            };
          });
          signaturePromises.push(tapKeySigPromise);
        }
        const tapScriptHashes = hashesForSig.filter((h) => !!h.leafHash);
        if (tapScriptHashes.length) {
          const tapScriptSigPromises = tapScriptHashes.map((tsh) => {
            return Promise.resolve(keyPair.signSchnorr(tsh.hash)).then(
              (signature) => {
                const tapScriptSig = [
                  {
                    pubkey: (0, bip371_1.toXOnly)(keyPair.publicKey),
                    signature: (0, bip371_1.serializeTaprootSignature)(
                      signature,
                      input.sighashType
                    ),
                    leafHash: tsh.leafHash
                  }
                ];
                return { tapScriptSig };
              }
            );
          });
          signaturePromises.push(...tapScriptSigPromises);
        }
        return Promise.all(signaturePromises).then((results) => {
          results.forEach((v) => this.data.updateInput(inputIndex, v));
        });
      }
      checkTaprootHashesForSig(inputIndex, input, keyPair, tapLeafHashToSign, allowedSighashTypes) {
        if (typeof keyPair.signSchnorr !== "function")
          throw new Error(
            `Need Schnorr Signer to sign taproot input #${inputIndex}.`
          );
        const hashesForSig = getTaprootHashesForSig(
          inputIndex,
          input,
          this.data.inputs,
          keyPair.publicKey,
          this.__CACHE,
          tapLeafHashToSign,
          allowedSighashTypes
        );
        if (!hashesForSig || !hashesForSig.length)
          throw new Error(
            `Can not sign for input #${inputIndex} with the key ${keyPair.publicKey.toString(
              "hex"
            )}`
          );
        return hashesForSig;
      }
      toBuffer() {
        checkCache(this.__CACHE);
        return this.data.toBuffer();
      }
      toHex() {
        checkCache(this.__CACHE);
        return this.data.toHex();
      }
      toBase64() {
        checkCache(this.__CACHE);
        return this.data.toBase64();
      }
      updateGlobal(updateData) {
        this.data.updateGlobal(updateData);
        return this;
      }
      updateInput(inputIndex, updateData) {
        if (updateData.witnessScript) checkInvalidP2WSH(updateData.witnessScript);
        (0, bip371_1.checkTaprootInputFields)(
          this.data.inputs[inputIndex],
          updateData,
          "updateInput"
        );
        this.data.updateInput(inputIndex, updateData);
        if (updateData.nonWitnessUtxo) {
          addNonWitnessTxCache(
            this.__CACHE,
            this.data.inputs[inputIndex],
            inputIndex
          );
        }
        return this;
      }
      updateOutput(outputIndex, updateData) {
        const outputData = this.data.outputs[outputIndex];
        (0, bip371_1.checkTaprootOutputFields)(
          outputData,
          updateData,
          "updateOutput"
        );
        this.data.updateOutput(outputIndex, updateData);
        return this;
      }
      addUnknownKeyValToGlobal(keyVal) {
        this.data.addUnknownKeyValToGlobal(keyVal);
        return this;
      }
      addUnknownKeyValToInput(inputIndex, keyVal) {
        this.data.addUnknownKeyValToInput(inputIndex, keyVal);
        return this;
      }
      addUnknownKeyValToOutput(outputIndex, keyVal) {
        this.data.addUnknownKeyValToOutput(outputIndex, keyVal);
        return this;
      }
      clearFinalizedInput(inputIndex) {
        this.data.clearFinalizedInput(inputIndex);
        return this;
      }
    };
    exports.Psbt = Psbt2;
    var transactionFromBuffer = (buffer) => new PsbtTransaction(buffer);
    var PsbtTransaction = class {
      constructor(buffer = Buffer2.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])) {
        this.tx = transaction_1.Transaction.fromBuffer(buffer);
        checkTxEmpty(this.tx);
        Object.defineProperty(this, "tx", {
          enumerable: false,
          writable: true
        });
      }
      getInputOutputCounts() {
        return {
          inputCount: this.tx.ins.length,
          outputCount: this.tx.outs.length
        };
      }
      addInput(input) {
        if (input.hash === void 0 || input.index === void 0 || !Buffer2.isBuffer(input.hash) && typeof input.hash !== "string" || typeof input.index !== "number") {
          throw new Error("Error adding input.");
        }
        const hash = typeof input.hash === "string" ? (0, bufferutils_1.reverseBuffer)(Buffer2.from(input.hash, "hex")) : input.hash;
        this.tx.addInput(hash, input.index, input.sequence);
      }
      addOutput(output) {
        if (output.script === void 0 || output.value === void 0 || !Buffer2.isBuffer(output.script) || typeof output.value !== "number") {
          throw new Error("Error adding output.");
        }
        this.tx.addOutput(output.script, output.value);
      }
      toBuffer() {
        return this.tx.toBuffer();
      }
    };
    function canFinalize(input, script, scriptType) {
      switch (scriptType) {
        case "pubkey":
        case "pubkeyhash":
        case "witnesspubkeyhash":
          return hasSigs(1, input.partialSig);
        case "multisig":
          const p2ms = payments3.p2ms({ output: script });
          return hasSigs(p2ms.m, input.partialSig, p2ms.pubkeys);
        default:
          return false;
      }
    }
    function checkCache(cache) {
      if (cache.__UNSAFE_SIGN_NONSEGWIT !== false) {
        throw new Error("Not BIP174 compliant, can not export");
      }
    }
    function hasSigs(neededSigs, partialSig, pubkeys) {
      if (!partialSig) return false;
      let sigs;
      if (pubkeys) {
        sigs = pubkeys.map((pkey) => {
          const pubkey = compressPubkey(pkey);
          return partialSig.find((pSig) => pSig.pubkey.equals(pubkey));
        }).filter((v) => !!v);
      } else {
        sigs = partialSig;
      }
      if (sigs.length > neededSigs) throw new Error("Too many signatures");
      return sigs.length === neededSigs;
    }
    function isFinalized(input) {
      return !!input.finalScriptSig || !!input.finalScriptWitness;
    }
    function bip32DerivationIsMine(root) {
      return (d) => {
        if (!d.masterFingerprint.equals(root.fingerprint)) return false;
        if (!root.derivePath(d.path).publicKey.equals(d.pubkey)) return false;
        return true;
      };
    }
    function check32Bit(num) {
      if (typeof num !== "number" || num !== Math.floor(num) || num > 4294967295 || num < 0) {
        throw new Error("Invalid 32 bit integer");
      }
    }
    function checkFees(psbt, cache, opts) {
      const feeRate = cache.__FEE_RATE || psbt.getFeeRate();
      const vsize = cache.__EXTRACTED_TX.virtualSize();
      const satoshis = feeRate * vsize;
      if (feeRate >= opts.maximumFeeRate) {
        throw new Error(
          `Warning: You are paying around ${(satoshis / 1e8).toFixed(8)} in fees, which is ${feeRate} satoshi per byte for a transaction with a VSize of ${vsize} bytes (segwit counted as 0.25 byte per byte). Use setMaximumFeeRate method to raise your threshold, or pass true to the first arg of extractTransaction.`
        );
      }
    }
    function checkInputsForPartialSig(inputs, action) {
      inputs.forEach((input) => {
        const throws = (0, bip371_1.isTaprootInput)(input) ? (0, bip371_1.checkTaprootInputForSigs)(input, action) : (0, psbtutils_1.checkInputForSig)(input, action);
        if (throws)
          throw new Error("Can not modify transaction, signatures exist.");
      });
    }
    function checkPartialSigSighashes(input) {
      if (!input.sighashType || !input.partialSig) return;
      const { partialSig, sighashType } = input;
      partialSig.forEach((pSig) => {
        const { hashType } = bscript2.signature.decode(pSig.signature);
        if (sighashType !== hashType) {
          throw new Error("Signature sighash does not match input sighash type");
        }
      });
    }
    function checkScriptForPubkey(pubkey, script, action) {
      if (!(0, psbtutils_1.pubkeyInScript)(pubkey, script)) {
        throw new Error(
          `Can not ${action} for this input with the key ${pubkey.toString("hex")}`
        );
      }
    }
    function checkTxEmpty(tx) {
      const isEmpty = tx.ins.every(
        (input) => input.script && input.script.length === 0 && input.witness && input.witness.length === 0
      );
      if (!isEmpty) {
        throw new Error("Format Error: Transaction ScriptSigs are not empty");
      }
    }
    function checkTxForDupeIns(tx, cache) {
      tx.ins.forEach((input) => {
        checkTxInputCache(cache, input);
      });
    }
    function checkTxInputCache(cache, input) {
      const key = (0, bufferutils_1.reverseBuffer)(Buffer2.from(input.hash)).toString("hex") + ":" + input.index;
      if (cache.__TX_IN_CACHE[key]) throw new Error("Duplicate input detected.");
      cache.__TX_IN_CACHE[key] = 1;
    }
    function scriptCheckerFactory(payment, paymentScriptName) {
      return (inputIndex, scriptPubKey, redeemScript, ioType) => {
        const redeemScriptOutput = payment({
          redeem: { output: redeemScript }
        }).output;
        if (!scriptPubKey.equals(redeemScriptOutput)) {
          throw new Error(
            `${paymentScriptName} for ${ioType} #${inputIndex} doesn't match the scriptPubKey in the prevout`
          );
        }
      };
    }
    var checkRedeemScript = scriptCheckerFactory(payments3.p2sh, "Redeem script");
    var checkWitnessScript = scriptCheckerFactory(
      payments3.p2wsh,
      "Witness script"
    );
    function getTxCacheValue(key, name, inputs, c) {
      if (!inputs.every(isFinalized))
        throw new Error(`PSBT must be finalized to calculate ${name}`);
      if (key === "__FEE_RATE" && c.__FEE_RATE) return c.__FEE_RATE;
      if (key === "__FEE" && c.__FEE) return c.__FEE;
      let tx;
      let mustFinalize = true;
      if (c.__EXTRACTED_TX) {
        tx = c.__EXTRACTED_TX;
        mustFinalize = false;
      } else {
        tx = c.__TX.clone();
      }
      inputFinalizeGetAmts(inputs, tx, c, mustFinalize);
      if (key === "__FEE_RATE") return c.__FEE_RATE;
      else if (key === "__FEE") return c.__FEE;
    }
    function getFinalScripts(inputIndex, input, script, isSegwit, isP2SH, isP2WSH) {
      const scriptType = classifyScript(script);
      if (!canFinalize(input, script, scriptType))
        throw new Error(`Can not finalize input #${inputIndex}`);
      return prepareFinalScripts(
        script,
        scriptType,
        input.partialSig,
        isSegwit,
        isP2SH,
        isP2WSH
      );
    }
    function prepareFinalScripts(script, scriptType, partialSig, isSegwit, isP2SH, isP2WSH) {
      let finalScriptSig;
      let finalScriptWitness;
      const payment = getPayment(script, scriptType, partialSig);
      const p2wsh = !isP2WSH ? null : payments3.p2wsh({ redeem: payment });
      const p2sh = !isP2SH ? null : payments3.p2sh({ redeem: p2wsh || payment });
      if (isSegwit) {
        if (p2wsh) {
          finalScriptWitness = (0, psbtutils_1.witnessStackToScriptWitness)(
            p2wsh.witness
          );
        } else {
          finalScriptWitness = (0, psbtutils_1.witnessStackToScriptWitness)(
            payment.witness
          );
        }
        if (p2sh) {
          finalScriptSig = p2sh.input;
        }
      } else {
        if (p2sh) {
          finalScriptSig = p2sh.input;
        } else {
          finalScriptSig = payment.input;
        }
      }
      return {
        finalScriptSig,
        finalScriptWitness
      };
    }
    function getHashAndSighashType(inputs, inputIndex, pubkey, cache, sighashTypes) {
      const input = (0, utils_1.checkForInput)(inputs, inputIndex);
      const { hash, sighashType, script } = getHashForSig(
        inputIndex,
        input,
        cache,
        false,
        sighashTypes
      );
      checkScriptForPubkey(pubkey, script, "sign");
      return {
        hash,
        sighashType
      };
    }
    function getHashForSig(inputIndex, input, cache, forValidate, sighashTypes) {
      const unsignedTx = cache.__TX;
      const sighashType = input.sighashType || transaction_1.Transaction.SIGHASH_ALL;
      checkSighashTypeAllowed(sighashType, sighashTypes);
      let hash;
      let prevout;
      if (input.nonWitnessUtxo) {
        const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
          cache,
          input,
          inputIndex
        );
        const prevoutHash = unsignedTx.ins[inputIndex].hash;
        const utxoHash = nonWitnessUtxoTx.getHash();
        if (!prevoutHash.equals(utxoHash)) {
          throw new Error(
            `Non-witness UTXO hash for input #${inputIndex} doesn't match the hash specified in the prevout`
          );
        }
        const prevoutIndex = unsignedTx.ins[inputIndex].index;
        prevout = nonWitnessUtxoTx.outs[prevoutIndex];
      } else if (input.witnessUtxo) {
        prevout = input.witnessUtxo;
      } else {
        throw new Error("Need a Utxo input item for signing");
      }
      const { meaningfulScript, type } = getMeaningfulScript(
        prevout.script,
        inputIndex,
        "input",
        input.redeemScript,
        input.witnessScript
      );
      if (["p2sh-p2wsh", "p2wsh"].indexOf(type) >= 0) {
        hash = unsignedTx.hashForWitnessV0(
          inputIndex,
          meaningfulScript,
          prevout.value,
          sighashType
        );
      } else if ((0, psbtutils_1.isP2WPKH)(meaningfulScript)) {
        const signingScript = payments3.p2pkh({
          hash: meaningfulScript.slice(2)
        }).output;
        hash = unsignedTx.hashForWitnessV0(
          inputIndex,
          signingScript,
          prevout.value,
          sighashType
        );
      } else {
        if (input.nonWitnessUtxo === void 0 && cache.__UNSAFE_SIGN_NONSEGWIT === false)
          throw new Error(
            `Input #${inputIndex} has witnessUtxo but non-segwit script: ${meaningfulScript.toString("hex")}`
          );
        if (!forValidate && cache.__UNSAFE_SIGN_NONSEGWIT !== false)
          console.warn(
            "Warning: Signing non-segwit inputs without the full parent transaction means there is a chance that a miner could feed you incorrect information to trick you into paying large fees. This behavior is the same as Psbt's predecessor (TransactionBuilder - now removed) when signing non-segwit scripts. You are not able to export this Psbt with toBuffer|toBase64|toHex since it is not BIP174 compliant.\n*********************\nPROCEED WITH CAUTION!\n*********************"
          );
        hash = unsignedTx.hashForSignature(
          inputIndex,
          meaningfulScript,
          sighashType
        );
      }
      return {
        script: meaningfulScript,
        sighashType,
        hash
      };
    }
    function getAllTaprootHashesForSig(inputIndex, input, inputs, cache) {
      const allPublicKeys = [];
      if (input.tapInternalKey) {
        const key = getPrevoutTaprootKey(inputIndex, input, cache);
        if (key) {
          allPublicKeys.push(key);
        }
      }
      if (input.tapScriptSig) {
        const tapScriptPubkeys = input.tapScriptSig.map((tss) => tss.pubkey);
        allPublicKeys.push(...tapScriptPubkeys);
      }
      const allHashes = allPublicKeys.map(
        (pubicKey) => getTaprootHashesForSig(inputIndex, input, inputs, pubicKey, cache)
      );
      return allHashes.flat();
    }
    function getPrevoutTaprootKey(inputIndex, input, cache) {
      const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
      return (0, psbtutils_1.isP2TR)(script) ? script.subarray(2, 34) : null;
    }
    function trimTaprootSig(signature) {
      return signature.length === 64 ? signature : signature.subarray(0, 64);
    }
    function getTaprootHashesForSig(inputIndex, input, inputs, pubkey, cache, tapLeafHashToSign, allowedSighashTypes) {
      const unsignedTx = cache.__TX;
      const sighashType = input.sighashType || transaction_1.Transaction.SIGHASH_DEFAULT;
      checkSighashTypeAllowed(sighashType, allowedSighashTypes);
      const prevOuts = inputs.map(
        (i, index) => getScriptAndAmountFromUtxo(index, i, cache)
      );
      const signingScripts = prevOuts.map((o) => o.script);
      const values = prevOuts.map((o) => o.value);
      const hashes = [];
      if (input.tapInternalKey && !tapLeafHashToSign) {
        const outputKey = getPrevoutTaprootKey(inputIndex, input, cache) || Buffer2.from([]);
        if ((0, bip371_1.toXOnly)(pubkey).equals(outputKey)) {
          const tapKeyHash = unsignedTx.hashForWitnessV1(
            inputIndex,
            signingScripts,
            values,
            sighashType
          );
          hashes.push({ pubkey, hash: tapKeyHash });
        }
      }
      const tapLeafHashes = (input.tapLeafScript || []).filter((tapLeaf) => (0, psbtutils_1.pubkeyInScript)(pubkey, tapLeaf.script)).map((tapLeaf) => {
        const hash = (0, bip341_1.tapleafHash)({
          output: tapLeaf.script,
          version: tapLeaf.leafVersion
        });
        return Object.assign({ hash }, tapLeaf);
      }).filter(
        (tapLeaf) => !tapLeafHashToSign || tapLeafHashToSign.equals(tapLeaf.hash)
      ).map((tapLeaf) => {
        const tapScriptHash = unsignedTx.hashForWitnessV1(
          inputIndex,
          signingScripts,
          values,
          sighashType,
          tapLeaf.hash
        );
        return {
          pubkey,
          hash: tapScriptHash,
          leafHash: tapLeaf.hash
        };
      });
      return hashes.concat(tapLeafHashes);
    }
    function checkSighashTypeAllowed(sighashType, sighashTypes) {
      if (sighashTypes && sighashTypes.indexOf(sighashType) < 0) {
        const str = sighashTypeToString(sighashType);
        throw new Error(
          `Sighash type is not allowed. Retry the sign method passing the sighashTypes array of whitelisted types. Sighash type: ${str}`
        );
      }
    }
    function getPayment(script, scriptType, partialSig) {
      let payment;
      switch (scriptType) {
        case "multisig":
          const sigs = getSortedSigs(script, partialSig);
          payment = payments3.p2ms({
            output: script,
            signatures: sigs
          });
          break;
        case "pubkey":
          payment = payments3.p2pk({
            output: script,
            signature: partialSig[0].signature
          });
          break;
        case "pubkeyhash":
          payment = payments3.p2pkh({
            output: script,
            pubkey: partialSig[0].pubkey,
            signature: partialSig[0].signature
          });
          break;
        case "witnesspubkeyhash":
          payment = payments3.p2wpkh({
            output: script,
            pubkey: partialSig[0].pubkey,
            signature: partialSig[0].signature
          });
          break;
      }
      return payment;
    }
    function getScriptFromInput(inputIndex, input, cache) {
      const unsignedTx = cache.__TX;
      const res = {
        script: null,
        isSegwit: false,
        isP2SH: false,
        isP2WSH: false
      };
      res.isP2SH = !!input.redeemScript;
      res.isP2WSH = !!input.witnessScript;
      if (input.witnessScript) {
        res.script = input.witnessScript;
      } else if (input.redeemScript) {
        res.script = input.redeemScript;
      } else {
        if (input.nonWitnessUtxo) {
          const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
            cache,
            input,
            inputIndex
          );
          const prevoutIndex = unsignedTx.ins[inputIndex].index;
          res.script = nonWitnessUtxoTx.outs[prevoutIndex].script;
        } else if (input.witnessUtxo) {
          res.script = input.witnessUtxo.script;
        }
      }
      if (input.witnessScript || (0, psbtutils_1.isP2WPKH)(res.script)) {
        res.isSegwit = true;
      }
      return res;
    }
    function getSignersFromHD(inputIndex, inputs, hdKeyPair) {
      const input = (0, utils_1.checkForInput)(inputs, inputIndex);
      if (!input.bip32Derivation || input.bip32Derivation.length === 0) {
        throw new Error("Need bip32Derivation to sign with HD");
      }
      const myDerivations = input.bip32Derivation.map((bipDv) => {
        if (bipDv.masterFingerprint.equals(hdKeyPair.fingerprint)) {
          return bipDv;
        } else {
          return;
        }
      }).filter((v) => !!v);
      if (myDerivations.length === 0) {
        throw new Error(
          "Need one bip32Derivation masterFingerprint to match the HDSigner fingerprint"
        );
      }
      const signers = myDerivations.map((bipDv) => {
        const node = hdKeyPair.derivePath(bipDv.path);
        if (!bipDv.pubkey.equals(node.publicKey)) {
          throw new Error("pubkey did not match bip32Derivation");
        }
        return node;
      });
      return signers;
    }
    function getSortedSigs(script, partialSig) {
      const p2ms = payments3.p2ms({ output: script });
      return p2ms.pubkeys.map((pk) => {
        return (partialSig.filter((ps) => {
          return ps.pubkey.equals(pk);
        })[0] || {}).signature;
      }).filter((v) => !!v);
    }
    function scriptWitnessToWitnessStack(buffer) {
      let offset = 0;
      function readSlice(n) {
        offset += n;
        return buffer.slice(offset - n, offset);
      }
      function readVarInt() {
        const vi = varuint.decode(buffer, offset);
        offset += varuint.decode.bytes;
        return vi;
      }
      function readVarSlice() {
        return readSlice(readVarInt());
      }
      function readVector() {
        const count = readVarInt();
        const vector = [];
        for (let i = 0; i < count; i++) vector.push(readVarSlice());
        return vector;
      }
      return readVector();
    }
    function sighashTypeToString(sighashType) {
      let text = sighashType & transaction_1.Transaction.SIGHASH_ANYONECANPAY ? "SIGHASH_ANYONECANPAY | " : "";
      const sigMod = sighashType & 31;
      switch (sigMod) {
        case transaction_1.Transaction.SIGHASH_ALL:
          text += "SIGHASH_ALL";
          break;
        case transaction_1.Transaction.SIGHASH_SINGLE:
          text += "SIGHASH_SINGLE";
          break;
        case transaction_1.Transaction.SIGHASH_NONE:
          text += "SIGHASH_NONE";
          break;
      }
      return text;
    }
    function addNonWitnessTxCache(cache, input, inputIndex) {
      cache.__NON_WITNESS_UTXO_BUF_CACHE[inputIndex] = input.nonWitnessUtxo;
      const tx = transaction_1.Transaction.fromBuffer(input.nonWitnessUtxo);
      cache.__NON_WITNESS_UTXO_TX_CACHE[inputIndex] = tx;
      const self2 = cache;
      const selfIndex = inputIndex;
      delete input.nonWitnessUtxo;
      Object.defineProperty(input, "nonWitnessUtxo", {
        enumerable: true,
        get() {
          const buf = self2.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex];
          const txCache = self2.__NON_WITNESS_UTXO_TX_CACHE[selfIndex];
          if (buf !== void 0) {
            return buf;
          } else {
            const newBuf = txCache.toBuffer();
            self2.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = newBuf;
            return newBuf;
          }
        },
        set(data) {
          self2.__NON_WITNESS_UTXO_BUF_CACHE[selfIndex] = data;
        }
      });
    }
    function inputFinalizeGetAmts(inputs, tx, cache, mustFinalize) {
      let inputAmount = 0;
      inputs.forEach((input, idx) => {
        if (mustFinalize && input.finalScriptSig)
          tx.ins[idx].script = input.finalScriptSig;
        if (mustFinalize && input.finalScriptWitness) {
          tx.ins[idx].witness = scriptWitnessToWitnessStack(
            input.finalScriptWitness
          );
        }
        if (input.witnessUtxo) {
          inputAmount += input.witnessUtxo.value;
        } else if (input.nonWitnessUtxo) {
          const nwTx = nonWitnessUtxoTxFromCache(cache, input, idx);
          const vout = tx.ins[idx].index;
          const out = nwTx.outs[vout];
          inputAmount += out.value;
        }
      });
      const outputAmount = tx.outs.reduce((total, o) => total + o.value, 0);
      const fee = inputAmount - outputAmount;
      if (fee < 0) {
        throw new Error("Outputs are spending more than Inputs");
      }
      const bytes = tx.virtualSize();
      cache.__FEE = fee;
      cache.__EXTRACTED_TX = tx;
      cache.__FEE_RATE = Math.floor(fee / bytes);
    }
    function nonWitnessUtxoTxFromCache(cache, input, inputIndex) {
      const c = cache.__NON_WITNESS_UTXO_TX_CACHE;
      if (!c[inputIndex]) {
        addNonWitnessTxCache(cache, input, inputIndex);
      }
      return c[inputIndex];
    }
    function getScriptFromUtxo(inputIndex, input, cache) {
      const { script } = getScriptAndAmountFromUtxo(inputIndex, input, cache);
      return script;
    }
    function getScriptAndAmountFromUtxo(inputIndex, input, cache) {
      if (input.witnessUtxo !== void 0) {
        return {
          script: input.witnessUtxo.script,
          value: input.witnessUtxo.value
        };
      } else if (input.nonWitnessUtxo !== void 0) {
        const nonWitnessUtxoTx = nonWitnessUtxoTxFromCache(
          cache,
          input,
          inputIndex
        );
        const o = nonWitnessUtxoTx.outs[cache.__TX.ins[inputIndex].index];
        return { script: o.script, value: o.value };
      } else {
        throw new Error("Can't find pubkey in input without Utxo data");
      }
    }
    function pubkeyInInput(pubkey, input, inputIndex, cache) {
      const script = getScriptFromUtxo(inputIndex, input, cache);
      const { meaningfulScript } = getMeaningfulScript(
        script,
        inputIndex,
        "input",
        input.redeemScript,
        input.witnessScript
      );
      return (0, psbtutils_1.pubkeyInScript)(pubkey, meaningfulScript);
    }
    function pubkeyInOutput(pubkey, output, outputIndex, cache) {
      const script = cache.__TX.outs[outputIndex].script;
      const { meaningfulScript } = getMeaningfulScript(
        script,
        outputIndex,
        "output",
        output.redeemScript,
        output.witnessScript
      );
      return (0, psbtutils_1.pubkeyInScript)(pubkey, meaningfulScript);
    }
    function redeemFromFinalScriptSig(finalScript) {
      if (!finalScript) return;
      const decomp = bscript2.decompile(finalScript);
      if (!decomp) return;
      const lastItem = decomp[decomp.length - 1];
      if (!Buffer2.isBuffer(lastItem) || isPubkeyLike(lastItem) || isSigLike(lastItem))
        return;
      const sDecomp = bscript2.decompile(lastItem);
      if (!sDecomp) return;
      return lastItem;
    }
    function redeemFromFinalWitnessScript(finalScript) {
      if (!finalScript) return;
      const decomp = scriptWitnessToWitnessStack(finalScript);
      const lastItem = decomp[decomp.length - 1];
      if (isPubkeyLike(lastItem)) return;
      const sDecomp = bscript2.decompile(lastItem);
      if (!sDecomp) return;
      return lastItem;
    }
    function compressPubkey(pubkey) {
      if (pubkey.length === 65) {
        const parity = pubkey[64] & 1;
        const newKey = pubkey.slice(0, 33);
        newKey[0] = 2 | parity;
        return newKey;
      }
      return pubkey.slice();
    }
    function isPubkeyLike(buf) {
      return buf.length === 33 && bscript2.isCanonicalPubKey(buf);
    }
    function isSigLike(buf) {
      return bscript2.isCanonicalScriptSignature(buf);
    }
    function getMeaningfulScript(script, index, ioType, redeemScript, witnessScript) {
      const isP2SH = (0, psbtutils_1.isP2SHScript)(script);
      const isP2SHP2WSH = isP2SH && redeemScript && (0, psbtutils_1.isP2WSHScript)(redeemScript);
      const isP2WSH = (0, psbtutils_1.isP2WSHScript)(script);
      if (isP2SH && redeemScript === void 0)
        throw new Error("scriptPubkey is P2SH but redeemScript missing");
      if ((isP2WSH || isP2SHP2WSH) && witnessScript === void 0)
        throw new Error(
          "scriptPubkey or redeemScript is P2WSH but witnessScript missing"
        );
      let meaningfulScript;
      if (isP2SHP2WSH) {
        meaningfulScript = witnessScript;
        checkRedeemScript(index, script, redeemScript, ioType);
        checkWitnessScript(index, redeemScript, witnessScript, ioType);
        checkInvalidP2WSH(meaningfulScript);
      } else if (isP2WSH) {
        meaningfulScript = witnessScript;
        checkWitnessScript(index, script, witnessScript, ioType);
        checkInvalidP2WSH(meaningfulScript);
      } else if (isP2SH) {
        meaningfulScript = redeemScript;
        checkRedeemScript(index, script, redeemScript, ioType);
      } else {
        meaningfulScript = script;
      }
      return {
        meaningfulScript,
        type: isP2SHP2WSH ? "p2sh-p2wsh" : isP2SH ? "p2sh" : isP2WSH ? "p2wsh" : "raw"
      };
    }
    function checkInvalidP2WSH(script) {
      if ((0, psbtutils_1.isP2WPKH)(script) || (0, psbtutils_1.isP2SHScript)(script)) {
        throw new Error("P2WPKH or P2SH can not be contained within P2WSH");
      }
    }
    function classifyScript(script) {
      if ((0, psbtutils_1.isP2WPKH)(script)) return "witnesspubkeyhash";
      if ((0, psbtutils_1.isP2PKH)(script)) return "pubkeyhash";
      if ((0, psbtutils_1.isP2MS)(script)) return "multisig";
      if ((0, psbtutils_1.isP2PK)(script)) return "pubkey";
      return "nonstandard";
    }
    function range(n) {
      return [...Array(n).keys()];
    }
  }
});

// node_modules/belcoinjs-lib/src/index.js
var require_src2 = __commonJS({
  "node_modules/belcoinjs-lib/src/index.js"(exports) {
    "use strict";
    init_buffer_shim();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Transaction = exports.opcodes = exports.Psbt = exports.Block = exports.script = exports.payments = exports.networks = exports.crypto = exports.address = void 0;
    var address2 = require_address();
    exports.address = address2;
    var crypto2 = require_crypto2();
    exports.crypto = crypto2;
    var networks2 = require_networks();
    exports.networks = networks2;
    var payments3 = require_payments();
    exports.payments = payments3;
    var script = require_script();
    exports.script = script;
    var block_1 = require_block();
    Object.defineProperty(exports, "Block", {
      enumerable: true,
      get: function() {
        return block_1.Block;
      }
    });
    var psbt_1 = require_psbt2();
    Object.defineProperty(exports, "Psbt", {
      enumerable: true,
      get: function() {
        return psbt_1.Psbt;
      }
    });
    var ops_1 = require_ops();
    Object.defineProperty(exports, "opcodes", {
      enumerable: true,
      get: function() {
        return ops_1.OPS;
      }
    });
    var transaction_1 = require_transaction();
    Object.defineProperty(exports, "Transaction", {
      enumerable: true,
      get: function() {
        return transaction_1.Transaction;
      }
    });
  }
});

// src/index.mjs
init_buffer_shim();
var import_belcoinjs_lib3 = __toESM(require_src2(), 1);

// src/inscribe.mjs
init_buffer_shim();
var import_belcoinjs_lib2 = __toESM(require_src2(), 1);

// src/consts.mjs
init_buffer_shim();
var MAX_CHUNK_LEN = 240;
var UTXO_MIN_VALUE = 1e3;

// src/utils.mjs
init_buffer_shim();
var import_belcoinjs_lib = __toESM(require_src2(), 1);
var AddressType = {
  P2PKH: 0,
  P2WPKH: 1,
  P2TR: 2
};
var toXOnly = (pubKey) => pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
var getWitnessUtxo = (utxo, addressType, publicKey, network) => {
  const value = import_belcoinjs_lib.Transaction.fromBuffer(Buffer2.from(utxo.hex, "hex")).outs[utxo.vout].value;
  switch (addressType) {
    case AddressType.P2TR:
      return {
        script: import_belcoinjs_lib.payments.p2tr({
          internalPubkey: toXOnly(publicKey),
          network
        }).output,
        value
      };
    case AddressType.P2PKH:
      return {
        script: import_belcoinjs_lib.payments.p2pkh({ pubkey: publicKey, network }).output,
        value
      };
    case AddressType.P2WPKH:
      return {
        script: import_belcoinjs_lib.payments.p2wpkh({ pubkey: publicKey, network }).output,
        value
      };
    default:
      return void 0;
  }
};
function getAddressType(addressStr, network) {
  try {
    const version = import_belcoinjs_lib.address.fromBase58Check(addressStr).version;
    if (version === network.pubKeyHash) return AddressType.P2PKH;
    if (version === network.scriptHash) return void 0;
  } catch {
    try {
      const version = import_belcoinjs_lib.address.fromBech32(addressStr).version;
      if (version === 0) return AddressType.P2WPKH;
      if (version === 1) return AddressType.P2TR;
    } catch {
    }
  }
  return void 0;
}

// src/inscribe.mjs
function buildInscriptionScript(xOnlyPubKey, contentType, data) {
  const chunks = [
    xOnlyPubKey,
    import_belcoinjs_lib2.script.OPS.OP_CHECKSIG,
    import_belcoinjs_lib2.script.OPS.OP_FALSE,
    import_belcoinjs_lib2.script.OPS.OP_IF,
    Buffer2.from("ord", "utf8"),
    1,
    1,
    Buffer2.from(contentType, "utf8"),
    0
  ];
  for (let i = 0; i < data.length; i += MAX_CHUNK_LEN) {
    chunks.push(data.subarray(i, Math.min(i + MAX_CHUNK_LEN, data.length)));
  }
  chunks.push(import_belcoinjs_lib2.script.OPS.OP_ENDIF);
  return import_belcoinjs_lib2.script.compile(chunks);
}
function buildP2TR(inscriptionScript, xOnlyPubKey, network) {
  return import_belcoinjs_lib2.payments.p2tr({
    internalPubkey: xOnlyPubKey,
    redeem: { output: inscriptionScript, redeemVersion: 192 },
    scriptTree: [{ output: inscriptionScript }, { output: inscriptionScript }],
    network
  });
}
async function calcFeeForRevealPsbt({
  payment,
  feeRate,
  toAddress,
  xOnlyPubKey,
  signPsbt,
  network
}) {
  const psbt = new import_belcoinjs_lib2.Psbt({ network });
  psbt.addInput({
    hash: Buffer2.alloc(32),
    index: 0,
    tapInternalKey: xOnlyPubKey,
    witnessUtxo: {
      script: payment.output,
      value: UTXO_MIN_VALUE + 100
    },
    tapLeafScript: [
      {
        leafVersion: payment.redeem.redeemVersion,
        script: payment.redeem.output,
        controlBlock: payment.witness[payment.witness.length - 1]
      }
    ]
  });
  psbt.addOutput({ address: toAddress, value: UTXO_MIN_VALUE });
  const signed = import_belcoinjs_lib2.Psbt.fromBase64(await signPsbt(psbt.toBase64(), true));
  return signed.extractTransaction(true).virtualSize() * feeRate;
}
async function calcFeeForFundPsbt({ psbt, feeRate, signPsbt }) {
  psbt.addOutput({ address: psbt.txOutputs[0].address, value: 0 });
  const signed = import_belcoinjs_lib2.Psbt.fromBase64(await signPsbt(psbt.toBase64()));
  return signed.extractTransaction(true).virtualSize() * feeRate;
}
async function inscribe({
  toAddress,
  contentType,
  data,
  feeRate,
  getUtxos,
  publicKey,
  signPsbt,
  network,
  fromAddress
}) {
  const xOnlyPubKey = toXOnly(publicKey);
  const addressType = getAddressType(fromAddress, network);
  const inscriptionScript = buildInscriptionScript(xOnlyPubKey, contentType, data);
  const payment = buildP2TR(inscriptionScript, xOnlyPubKey, network);
  const revealFee = await calcFeeForRevealPsbt({
    payment,
    feeRate,
    toAddress,
    xOnlyPubKey,
    signPsbt,
    network
  });
  const requiredAmount = revealFee + UTXO_MIN_VALUE;
  const utxos = await getUtxos(requiredAmount);
  if (!utxos || !Array.isArray(utxos) || utxos.length === 0) {
    throw new Error("Insufficient funds");
  }
  if (utxos.length > 500) {
    throw new Error("Too many UTXOs. Consolidate first.");
  }
  const totalValue = utxos.reduce((acc, u) => acc + u.value, 0);
  const fundPsbt = new import_belcoinjs_lib2.Psbt({ network });
  for (const utxo of utxos) {
    fundPsbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: getWitnessUtxo(utxo, addressType, publicKey, network),
      nonWitnessUtxo: Buffer2.from(utxo.hex, "hex")
    });
  }
  fundPsbt.addOutput({ address: payment.address, value: requiredAmount });
  const txFee = await calcFeeForFundPsbt({
    psbt: fundPsbt.clone(),
    feeRate,
    signPsbt
  });
  const change = totalValue - requiredAmount - txFee;
  if (change >= UTXO_MIN_VALUE) {
    fundPsbt.addOutput({ address: fromAddress, value: change });
  } else if (change < 0) {
    throw new Error(
      `Insufficient funds: have ${totalValue}, need ${requiredAmount + txFee}`
    );
  }
  const signedFund = import_belcoinjs_lib2.Psbt.fromBase64(await signPsbt(fundPsbt.toBase64()));
  const fundTx = signedFund.extractTransaction(true);
  const revealPsbt = new import_belcoinjs_lib2.Psbt({ network });
  revealPsbt.addInput({
    hash: fundTx.getId(),
    index: 0,
    witnessUtxo: { script: payment.output, value: requiredAmount },
    tapLeafScript: [
      {
        leafVersion: 192,
        script: inscriptionScript,
        controlBlock: payment.witness[payment.witness.length - 1]
      }
    ],
    tapInternalKey: xOnlyPubKey
  });
  revealPsbt.addOutput({ address: toAddress, value: UTXO_MIN_VALUE });
  const signedReveal = import_belcoinjs_lib2.Psbt.fromBase64(
    await signPsbt(revealPsbt.toBase64(), true)
  );
  const revealTx = signedReveal.extractTransaction(true);
  return {
    fundTxHex: fundTx.toHex(),
    revealTxHex: revealTx.toHex(),
    inscriptionId: `${revealTx.getId()}i0`
  };
}

// src/index.mjs
var BELLS_MAINNET = import_belcoinjs_lib3.networks.bellcoin;
var BELLS_TESTNET = import_belcoinjs_lib3.networks.testnet;
function networkForKey(key) {
  switch (String(key)) {
    case "bells-mainnet":
    case "bellsMainnet":
    case "mainnet":
      return BELLS_MAINNET;
    case "bells-testnet":
    case "bellsTestnet":
    case "testnet":
      return BELLS_TESTNET;
    default:
      throw new Error(`Unknown Bells network key: ${key}`);
  }
}
export {
  BELLS_MAINNET,
  BELLS_TESTNET,
  inscribe,
  networkForKey
};
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)

@noble/hashes/utils.js:
@noble/hashes/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

safe-buffer/index.js:
  (*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> *)
*/
//# sourceMappingURL=pokebells-inscriber.browser.mjs.map
