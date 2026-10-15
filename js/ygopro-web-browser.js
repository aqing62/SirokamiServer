var YGO = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // entry-browser.mjs
  var entry_browser_exports = {};
  __export(entry_browser_exports, {
    ENVELOPE_IDS: () => ENVELOPE_IDS,
    FrameScanner: () => FrameScanner,
    IndexResponse: () => IndexResponse,
    YGOProCtosHandResult: () => YGOProCtosHandResult,
    YGOProCtosHsReady: () => YGOProCtosHsReady,
    YGOProCtosHsStart: () => YGOProCtosHsStart,
    YGOProCtosJoinGame: () => YGOProCtosJoinGame,
    YGOProCtosPlayerInfo: () => YGOProCtosPlayerInfo,
    YGOProCtosResponse: () => YGOProCtosResponse,
    YGOProCtosTimeConfirm: () => YGOProCtosTimeConfirm,
    YGOProCtosTpResult: () => YGOProCtosTpResult,
    YGOProCtosUpdateDeck: () => YGOProCtosUpdateDeck,
    YGOProDeck: () => YGOProDeck,
    YGOProMessages: () => YGOProMessages,
    YGOProMsgDeckTop: () => YGOProMsgDeckTop,
    YGOProMsgResponseBase: () => YGOProMsgResponseBase,
    YGOProMsgReverseDeck: () => YGOProMsgReverseDeck,
    YGOProMsgSelectBattleCmd: () => YGOProMsgSelectBattleCmd,
    YGOProMsgSelectCard: () => YGOProMsgSelectCard,
    YGOProMsgSelectIdleCmd: () => YGOProMsgSelectIdleCmd,
    YGOProMsgSelectPlaceCommon: () => YGOProMsgSelectPlaceCommon,
    YGOProMsgSelectPosition: () => YGOProMsgSelectPosition,
    YGOProMsgSelectTribute: () => YGOProMsgSelectTribute,
    YGOProMsgSelectUnselectCard: () => YGOProMsgSelectUnselectCard,
    YGOProMsgSortCard: () => YGOProMsgSortCard,
    YGOProStoc: () => YGOProStoc,
    YGOProStocChat: () => YGOProStocChat,
    YGOProStocErrorMsg: () => YGOProStocErrorMsg,
    YGOProStocGameMsg: () => YGOProStocGameMsg,
    YGOProStocHsPlayerChange: () => YGOProStocHsPlayerChange,
    YGOProStocHsPlayerEnter: () => YGOProStocHsPlayerEnter,
    YGOProStocJoinGame: () => YGOProStocJoinGame,
    YGOProStocSelectHand: () => YGOProStocSelectHand,
    YGOProStocSelectTp: () => YGOProStocSelectTp,
    YGOProStocTimeLimit: () => YGOProStocTimeLimit,
    YGOProStocTypeChange: () => YGOProStocTypeChange,
    encodeFrame: () => encodeFrame,
    frameLength: () => frameLength,
    framePayload: () => framePayload,
    isIndexResponse: () => isIndexResponse,
    isMapped: () => isMapped,
    toEnvelope: () => toEnvelope
  });

  // ../ws-probe/node_modules/typed-reflector/dist/index.mjs
  var GLOBAL_REGISTRY_KEY = /* @__PURE__ */ Symbol.for("typed-reflector.global-registry");
  function getPropertyBucket(store, propertyKey, create) {
    const bucket = store.properties.get(propertyKey);
    if (bucket || !create) {
      return bucket;
    }
    const nextBucket = /* @__PURE__ */ new Map();
    store.properties.set(propertyKey, nextBucket);
    return nextBucket;
  }
  var MetadataRegistry = class {
    constructor() {
      this.store = /* @__PURE__ */ new WeakMap();
    }
    getStore(target, create) {
      const store = this.store.get(target);
      if (store || !create) {
        return store;
      }
      const nextStore = {
        target: /* @__PURE__ */ new Map(),
        properties: /* @__PURE__ */ new Map()
      };
      this.store.set(target, nextStore);
      return nextStore;
    }
    getOwnBucket(target, propertyKey, create = false) {
      const store = this.getStore(target, create);
      if (!store) {
        return void 0;
      }
      if (propertyKey === void 0) {
        return store.target;
      }
      return getPropertyBucket(store, propertyKey, create);
    }
    *walkPrototypeChain(target) {
      let current = target;
      while (current) {
        yield current;
        current = Object.getPrototypeOf(current);
      }
    }
    defineMetadata(metadataKey, value, target, propertyKey) {
      const bucket = this.getOwnBucket(target, propertyKey, true);
      bucket.set(metadataKey, value);
    }
    hasOwnMetadata(metadataKey, target, propertyKey) {
      return this.getOwnBucket(target, propertyKey)?.has(metadataKey) ?? false;
    }
    hasMetadata(metadataKey, target, propertyKey) {
      for (const current of this.walkPrototypeChain(target)) {
        if (this.hasOwnMetadata(metadataKey, current, propertyKey)) {
          return true;
        }
      }
      return false;
    }
    getOwnMetadata(metadataKey, target, propertyKey) {
      return this.getOwnBucket(target, propertyKey)?.get(metadataKey);
    }
    getMetadata(metadataKey, target, propertyKey) {
      for (const current of this.walkPrototypeChain(target)) {
        const bucket = this.getOwnBucket(current, propertyKey);
        if (bucket?.has(metadataKey)) {
          return bucket.get(metadataKey);
        }
      }
      return void 0;
    }
  };
  var globalRegistryHost = globalThis;
  var GlobalRegistry = globalRegistryHost[GLOBAL_REGISTRY_KEY] || (globalRegistryHost[GLOBAL_REGISTRY_KEY] = new MetadataRegistry());
  function isClass(target) {
    if (typeof target !== "function") {
      return false;
    }
    const proto = target.constructor;
    return proto === Function;
  }
  function getClass(target) {
    return isClass(target) ? target : getClass(target.constructor);
  }
  var MODERN_REGISTRY_TARGETS_KEY = /* @__PURE__ */ Symbol.for(
    "typed-reflector.modern.registry-targets"
  );
  function ensureSymbolMetadata() {
    const symbolCtor = Symbol;
    if (!symbolCtor.metadata) {
      Object.defineProperty(symbolCtor, "metadata", {
        value: /* @__PURE__ */ Symbol("Symbol.metadata"),
        configurable: true
      });
    }
    return symbolCtor.metadata;
  }
  function ensureRegistryTargets(metadata) {
    if (Object.prototype.hasOwnProperty.call(metadata, MODERN_REGISTRY_TARGETS_KEY)) {
      return metadata[MODERN_REGISTRY_TARGETS_KEY];
    }
    const parent = Object.getPrototypeOf(metadata);
    const parentTargets = parent ? ensureRegistryTargets(parent) : void 0;
    const targets = {
      target: Object.create(parentTargets?.target ?? null),
      staticProperties: Object.create(parentTargets?.staticProperties ?? null),
      instanceProperties: Object.create(
        parentTargets?.instanceProperties ?? null
      )
    };
    metadata[MODERN_REGISTRY_TARGETS_KEY] = targets;
    return targets;
  }
  function getClassMetadataObject(target) {
    const symbolMetadata = ensureSymbolMetadata();
    return target[symbolMetadata];
  }
  function getRegistryTarget(metadata, isStatic, propertyKey) {
    const targets = ensureRegistryTargets(metadata);
    if (propertyKey === void 0) {
      return targets.target;
    }
    return isStatic ? targets.staticProperties : targets.instanceProperties;
  }
  var BaseReflector = class {
    constructor(options = {}) {
      this.registry = options.registry || GlobalRegistry;
    }
    prepareMetadataValue(metadataValue) {
      if (Array.isArray(metadataValue)) {
        return metadataValue.slice();
      }
      return metadataValue;
    }
    readMetadataInDecorator(metadataKey, context) {
      const target = this.resolveDecoratorMetadataTarget(context);
      return target.key !== void 0 ? this.registry.getMetadata(metadataKey, target.target, target.key) : this.registry.getMetadata(metadataKey, target.target);
    }
    writeMetadataInDecorator(metadataKey, metadataValue, context) {
      const target = this.resolveDecoratorMetadataTarget(context);
      if (target.key !== void 0) {
        this.registry.defineMetadata(
          metadataKey,
          metadataValue,
          target.target,
          target.key
        );
        return;
      }
      this.registry.defineMetadata(metadataKey, metadataValue, target.target);
    }
    appendIndexedKey(metadataKey, context) {
      const indexedKey = this.resolveIndexedKey(context);
      const keysContext = this.resolveKeysIndexContext(context);
      if (indexedKey === void 0 || !keysContext) {
        return;
      }
      this.applyMetadataTransform(
        metadataKey,
        (currentValue) => {
          const nextValue = currentValue || [];
          if (!nextValue.includes(indexedKey)) {
            nextValue.push(indexedKey);
          }
          return nextValue;
        },
        keysContext
      );
    }
    applyMetadataTransform(metadataKey, metadataValueFun, context, keysIndexMeta) {
      const oldValue = this.prepareMetadataValue(
        this.readMetadataInDecorator(metadataKey, context)
      );
      const newValue = metadataValueFun(oldValue);
      this.writeMetadataInDecorator(metadataKey, newValue, context);
      if (keysIndexMeta !== void 0) {
        this.appendIndexedKey(keysIndexMeta, context);
      }
    }
    setParameterMetadata(metadataKey, metadataValue, context, index) {
      const oldValue = this.prepareMetadataValue(
        this.readMetadataInDecorator(metadataKey, context)
      );
      const nextValue = oldValue || [];
      nextValue[index] = metadataValue;
      this.writeMetadataInDecorator(
        metadataKey,
        nextValue,
        context
      );
    }
    getClassMetadataTargets(instance) {
      const instanceClass = getClass(instance);
      const targets = [instanceClass];
      const modernMetadata = getClassMetadataObject(instanceClass);
      if (modernMetadata) {
        targets.unshift(getRegistryTarget(modernMetadata, void 0));
      }
      return Array.from(new Set(targets));
    }
    getMemberMetadataTargets(instance, key) {
      const instanceClass = getClass(instance);
      const isPrototypeTarget = !isClass(instance) && instance === instanceClass.prototype;
      const prototypeTarget = isClass(instance) ? instanceClass.prototype : isPrototypeTarget ? instance : Object.getPrototypeOf(instance);
      const legacyTargets = isClass(instance) ? [instanceClass, prototypeTarget] : [prototypeTarget, instanceClass];
      const modernMetadata = getClassMetadataObject(instanceClass);
      const modernTargets = modernMetadata ? [
        getRegistryTarget(modernMetadata, isClass(instance), key),
        getRegistryTarget(modernMetadata, !isClass(instance), key)
      ] : [];
      return Array.from(/* @__PURE__ */ new Set([...modernTargets, ...legacyTargets]));
    }
    transform(metadataKey, metadataValueFun, keysIndexMeta) {
      return this.createDecorator(
        metadataKey,
        metadataValueFun,
        keysIndexMeta
      );
    }
    set(metadataKey, metadataValue, keysIndexMeta) {
      return this.transform(
        metadataKey,
        () => metadataValue,
        keysIndexMeta
      );
    }
    append(metadataKey, metadataValue, keysIndexMeta) {
      return this.transform(
        metadataKey,
        (currentValue) => {
          const nextValue = currentValue || [];
          nextValue.push(metadataValue);
          return nextValue;
        },
        keysIndexMeta
      );
    }
    appendUnique(metadataKey, metadataValue, keysIndexMeta) {
      return this.transform(
        metadataKey,
        (currentValue) => {
          const nextValue = currentValue || [];
          if (!nextValue.includes(metadataValue)) {
            nextValue.push(metadataValue);
          }
          return nextValue;
        },
        keysIndexMeta
      );
    }
    concat(metadataKey, metadataValue, keysIndexMeta) {
      return this.transform(
        metadataKey,
        (currentValue) => (currentValue || []).concat(metadataValue),
        keysIndexMeta
      );
    }
    get(metadataKey, instance, key) {
      const targets = key !== void 0 ? this.getMemberMetadataTargets(instance, key) : this.getClassMetadataTargets(instance);
      for (const target of targets) {
        if (key !== void 0 ? this.registry.hasMetadata(metadataKey, target, key) : this.registry.hasMetadata(metadataKey, target)) {
          return key !== void 0 ? this.registry.getMetadata(metadataKey, target, key) : this.registry.getMetadata(metadataKey, target);
        }
      }
      return void 0;
    }
    getArray(metadataKey, instance, key) {
      return this.get(
        metadataKey,
        instance,
        key
      ) || [];
    }
    getProperty(metadataKey, instance, key, alternate) {
      const valueFromClass = this.getArray(metadataKey, instance);
      const valueFromAlternate = alternate ? this.getArray(metadataKey, alternate) : [];
      const valueFromProperty = this.getArray(metadataKey, instance, key);
      return [
        ...valueFromClass,
        ...valueFromAlternate,
        ...valueFromProperty
      ];
    }
  };
  var Reflector = class extends BaseReflector {
    prepareMetadataValue(metadataValue) {
      return metadataValue;
    }
    resolveDecoratorMetadataTarget(context) {
      return context;
    }
    resolveKeysIndexContext(context) {
      if (context.key === void 0) {
        return void 0;
      }
      return { target: getClass(context.target) };
    }
    resolveIndexedKey(context) {
      return context.key;
    }
    createDecorator(metadataKey, metadataValueFun, keysIndexMeta) {
      return (target, key) => {
        this.applyMetadataTransform(
          metadataKey,
          metadataValueFun,
          { target, key },
          keysIndexMeta
        );
      };
    }
    getMetadataFromDecorator(dec, metadataKey, options = {}) {
      class TempClass {
      }
      if (options.index !== void 0) {
        const parameterDecorator = dec;
        parameterDecorator(
          options.key === void 0 ? TempClass : TempClass.prototype,
          options.key,
          options.index
        );
        if (options.key !== void 0) {
          return this.get(metadataKey, TempClass, options.key);
        }
        return this.get(metadataKey, TempClass);
      }
      const propertyKey = options.key ?? "_temp_property_key_" + Math.random().toString(16).slice(2);
      const decorator = dec;
      decorator(TempClass.prototype, propertyKey);
      return this.get(metadataKey, TempClass, propertyKey);
    }
    param(metadataKey, metadataValue, keysIndexMeta) {
      return (target, key, index) => {
        this.setParameterMetadata(
          metadataKey,
          metadataValue,
          {
            target,
            key
          },
          index
        );
        if (keysIndexMeta !== void 0 && key !== void 0) {
          this.appendIndexedKey(keysIndexMeta, {
            target,
            key
          });
        }
      };
    }
  };

  // ../ws-probe/node_modules/ygopro-deck-encode/dist/index.mjs
  function toBase64Url(bytes) {
    const base64 = typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("base64") : btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromBase64Url(encoded) {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
    if (typeof Buffer !== "undefined") {
      return Uint8Array.from(Buffer.from(padded, "base64"));
    }
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  function countItems(arr) {
    const map = /* @__PURE__ */ new Map();
    for (const item of arr) {
      map.set(item, (map.get(item) || 0) + 1);
    }
    const blocks = [];
    for (const [item, count] of map.entries()) {
      blocks.push({ item, count });
    }
    return blocks;
  }
  function countConsecutiveItems(arr) {
    const result = [];
    if (arr.length === 0)
      return result;
    let currentItem = arr[0];
    let count = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === currentItem) {
        count++;
      } else {
        result.push({ item: currentItem, count });
        currentItem = arr[i];
        count = 1;
      }
    }
    result.push({ item: currentItem, count });
    return result;
  }
  var BufferCursor = class {
    buffer;
    pointer = 0;
    constructor(bufOrLength) {
      if (typeof bufOrLength === "number") {
        this.buffer = new Uint8Array(bufOrLength);
      } else {
        this.buffer = bufOrLength;
      }
    }
    /**
     * 安全地将 pointer 向前移动指定字节数。
     * @param bytes 要移动的字节数
     * @returns 原来 pointer 的值
     * @throws RangeError 如果越界
     */
    increasePointer(bytes) {
      const old = this.pointer;
      const next = old + bytes;
      if (next > this.buffer.length) {
        throw new RangeError(
          `Pointer overflow: tried to move to ${next}, but buffer length is ${this.buffer.length}`
        );
      }
      this.pointer = next;
      return old;
    }
  };
  var BufferWriter = class extends BufferCursor {
    constructor(length) {
      super(length);
    }
    writeUint32LE(value) {
      const idx = this.increasePointer(4);
      this.buffer[idx] = value & 255;
      this.buffer[idx + 1] = value >>> 8 & 255;
      this.buffer[idx + 2] = value >>> 16 & 255;
      this.buffer[idx + 3] = value >>> 24 & 255;
      return this;
    }
    writeUint32BE(value) {
      const idx = this.increasePointer(4);
      this.buffer[idx] = value >>> 24 & 255;
      this.buffer[idx + 1] = value >>> 16 & 255;
      this.buffer[idx + 2] = value >>> 8 & 255;
      this.buffer[idx + 3] = value & 255;
      return this;
    }
    writeUint16LE(value) {
      const idx = this.increasePointer(2);
      this.buffer[idx] = value & 255;
      this.buffer[idx + 1] = value >>> 8 & 255;
      return this;
    }
    writeUint16BE(value) {
      const idx = this.increasePointer(2);
      this.buffer[idx] = value >>> 8 & 255;
      this.buffer[idx + 1] = value & 255;
      return this;
    }
    writeUint8(value) {
      const idx = this.increasePointer(1);
      this.buffer[idx] = value & 255;
      return this;
    }
    writeString(str) {
      for (let i = 0; i < str.length; i++) {
        const idx = this.increasePointer(1);
        this.buffer[idx] = str.charCodeAt(i);
      }
      return this;
    }
  };
  var BufferReader = class extends BufferCursor {
    constructor(buf) {
      super(buf);
    }
    readUint32LE() {
      const idx = this.increasePointer(4);
      const b = this.buffer;
      return (b[idx] | b[idx + 1] << 8 | b[idx + 2] << 16 | b[idx + 3] << 24) >>> 0;
    }
    readUint32BE() {
      const idx = this.increasePointer(4);
      const b = this.buffer;
      return (b[idx] << 24 | b[idx + 1] << 16 | b[idx + 2] << 8 | b[idx + 3]) >>> 0;
    }
    readUint16LE() {
      const idx = this.increasePointer(2);
      const b = this.buffer;
      return b[idx] | b[idx + 1] << 8;
    }
    readUint16BE() {
      const idx = this.increasePointer(2);
      const b = this.buffer;
      return b[idx] << 8 | b[idx + 1];
    }
    readUint8() {
      const idx = this.increasePointer(1);
      return this.buffer[idx];
    }
    readString(length) {
      let s = "";
      for (let i = 0; i < length; i++) {
        const idx = this.increasePointer(1);
        s += String.fromCharCode(this.buffer[idx]);
      }
      return s;
    }
    readRemaining() {
      const remaining = this.buffer.length - this.pointer;
      const idx = this.increasePointer(remaining);
      return this.buffer.subarray(idx, this.buffer.length);
    }
  };
  var arrayEquals = (a, b) => {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  };
  function decodeBase64(base64) {
    if (typeof Buffer !== "undefined") {
      return Uint8Array.from(Buffer.from(base64, "base64"));
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  function encodeBase64(bytes) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  function base64ToUint32Array(base64) {
    const bytes = decodeBase64(base64);
    const view = new DataView(bytes.buffer);
    const result = [];
    for (let i = 0; i < bytes.length; i += 4) {
      result.push(view.getUint32(i, true));
    }
    return result;
  }
  function uint32ArrayToBase64(data) {
    const buffer = new ArrayBuffer(data.length * 4);
    const view = new DataView(buffer);
    data.forEach((val, i) => view.setUint32(i * 4, val, true));
    return encodeBase64(new Uint8Array(buffer));
  }
  function toYdkeURL(deck) {
    return "ydke://" + uint32ArrayToBase64(deck.main) + "!" + uint32ArrayToBase64(deck.extra) + "!" + uint32ArrayToBase64(deck.side) + "!";
  }
  function fromYdkeURL(ydke) {
    if (!ydke.startsWith("ydke://")) {
      throw new Error("Invalid ydke:// URI");
    }
    const [mainStr, extraStr, sideStr] = ydke.slice(7).split("!");
    if (mainStr === void 0 || extraStr === void 0 || sideStr === void 0) {
      throw new Error("Incomplete ydke:// URI");
    }
    return {
      main: base64ToUint32Array(mainStr),
      extra: base64ToUint32Array(extraStr),
      side: base64ToUint32Array(sideStr)
    };
  }
  var QUERY_YGO_TYPE = "ygotype";
  var QUERY_VERSION = "v";
  var ARG_DECK = "deck";
  var QUERY_DECK = "d";
  var QUERY_NAME = "name";
  var URL_SCHEME_HTTP = "http";
  var URL_HOST_DECK = "deck.ourygo.top";
  var BitWriter = class {
    buffer = [];
    current = 0;
    bitPos = 0;
    writeBits(value, length) {
      while (length > 0) {
        const remain = 8 - this.bitPos;
        const take = Math.min(remain, length);
        const shift = length - take;
        this.current |= (value >>> shift & (1 << take) - 1) << remain - take;
        this.bitPos += take;
        length -= take;
        if (this.bitPos === 8) {
          this.buffer.push(this.current);
          this.current = 0;
          this.bitPos = 0;
        }
      }
    }
    finish() {
      if (this.bitPos > 0)
        this.buffer.push(this.current);
      return new Uint8Array(this.buffer);
    }
  };
  var BitReader = class {
    constructor(bytes) {
      this.bytes = bytes;
    }
    index = 0;
    bitPos = 0;
    readBits(length) {
      let result = 0;
      while (length > 0) {
        const remain = 8 - this.bitPos;
        const take = Math.min(remain, length);
        const bits = this.bytes[this.index] >>> remain - take & (1 << take) - 1;
        result = result << take | bits;
        this.bitPos += take;
        length -= take;
        if (this.bitPos === 8) {
          this.bitPos = 0;
          this.index++;
        }
      }
      return result;
    }
  };
  function countUnique(cards) {
    let count = 0;
    for (let i = 0; i < cards.length; ) {
      const id = cards[i];
      count++;
      while (i < cards.length && cards[i] === id)
        i++;
    }
    return count;
  }
  function toYGOMobileDeckURL(main, extra, side, customParams = {}) {
    const mNum = countUnique(main);
    const eNum = countUnique(extra);
    const sNum = countUnique(side);
    const writer = new BitWriter();
    writer.writeBits(mNum, 8);
    writer.writeBits(eNum, 4);
    writer.writeBits(sNum, 4);
    const encodeSection = (cards) => {
      for (let i = 0; i < cards.length; ) {
        const id = cards[i];
        let count = 1;
        while (i + count < cards.length && cards[i + count] === id && count < 3)
          count++;
        const prefix = count === 2 ? 2 : count === 3 ? 3 : 1;
        writer.writeBits(prefix, 2);
        writer.writeBits(id, 27);
        i += count;
      }
    };
    encodeSection(main);
    encodeSection(extra);
    encodeSection(side);
    const encoded = toBase64Url(writer.finish());
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(customParams)) {
      searchParams.set(k, v);
    }
    searchParams.set(QUERY_YGO_TYPE, ARG_DECK);
    searchParams.set(QUERY_VERSION, "1");
    searchParams.set(QUERY_DECK, encoded);
    return `${URL_SCHEME_HTTP}://${URL_HOST_DECK}?${searchParams.toString()}`;
  }
  function fromYGOMobileDeckURL(uri) {
    const url = new URL(uri);
    if (url.searchParams.get(QUERY_YGO_TYPE) !== ARG_DECK) {
      throw new Error("Invalid deck URL");
    }
    const encoded = url.searchParams.get(QUERY_DECK);
    if (!encoded)
      throw new Error("Missing deck data");
    const bytes = fromBase64Url(encoded);
    const reader = new BitReader(bytes);
    const mNum = reader.readBits(8);
    const eNum = reader.readBits(4);
    const sNum = reader.readBits(4);
    const total = mNum + eNum + sNum;
    const result = {
      main: [],
      extra: [],
      side: []
    };
    for (let i = 0; i < total; i++) {
      const prefix = reader.readBits(2);
      const count = prefix === 2 ? 2 : prefix === 3 ? 3 : 1;
      const id = reader.readBits(27);
      const target = i < mNum ? result.main : i < mNum + eNum ? result.extra : result.side;
      for (let j = 0; j < count; j++) {
        target.push(id);
      }
    }
    return {
      ...result,
      name: url.searchParams.get(QUERY_NAME) ?? void 0
    };
  }
  var YGOProDeck = class {
    main = [];
    extra = [];
    side = [];
    name;
    constructor(init = {}) {
      this.main = init.main ? [...init.main] : [];
      this.extra = init.extra ? [...init.extra] : [];
      this.side = init.side ? [...init.side] : [];
      this.name = init.name;
    }
    bufferLength(noCompact = false) {
      const counted = [this.main, this.extra, this.side].map(
        noCompact ? countConsecutiveItems : countItems
      );
      return counted.reduce((a, b) => a + b.length * 4, 0);
    }
    toUint8Array(noCompact = false) {
      const counted = [this.main, this.extra, this.side].map(
        noCompact ? countConsecutiveItems : countItems
      );
      const writer = new BufferWriter(
        counted.reduce((a, b) => a + b.length * 4, 0)
      );
      const writeCards = (countMap, type) => {
        for (const { item, count } of countMap) {
          if (count > 4) {
            throw new Error(`Too many cards: ${item}`);
          }
          const value = item & 268435455 | type << 28 | count - 1 << 30;
          writer.writeUint32LE(value);
        }
      };
      counted.forEach(writeCards);
      return writer.buffer;
    }
    toEncodedString(noCompact = false) {
      return toBase64Url(this.toUint8Array(noCompact));
    }
    toString(noCompact = false) {
      return this.toEncodedString(noCompact);
    }
    fromUint8Array(buf) {
      for (let i = 0; i < buf.length - 3; i += 4) {
        const value = buf[i] | buf[i + 1] << 8 | buf[i + 2] << 16 | buf[i + 3] << 24;
        const id = value & 268435455;
        const type = value >>> 28 & 3;
        const count = (value >>> 30 & 3) + 1;
        const cards = [this.main, this.extra, this.side][type];
        for (let j = 0; j < count; j++) {
          cards.push(id);
        }
      }
      return this;
    }
    static fromUint8Array(buf) {
      return new YGOProDeck().fromUint8Array(buf);
    }
    fromEncodedString(str) {
      return this.fromUint8Array(fromBase64Url(str));
    }
    static fromEncodedString(str) {
      return new YGOProDeck().fromEncodedString(str);
    }
    toYdkString() {
      return [
        "#created by ygopro-deck-encode",
        "#main",
        ...this.main.map((id) => id.toString()),
        "#extra",
        ...this.extra.map((id) => id.toString()),
        "!side",
        ...this.side.map((id) => id.toString())
      ].join("\n");
    }
    fromYdkString(str) {
      const lines = str.split(/\r?\n/);
      let current = this.main;
      for (const _line of lines) {
        const line = _line.trim();
        if (line === "#main") {
          current = this.main;
        }
        if (line === "#extra") {
          current = this.extra;
        }
        if (line === "!side") {
          current = this.side;
        }
        if (line.match(/^\d+$/)) {
          current.push(parseInt(line, 10));
        }
      }
      return this;
    }
    static fromYdkString(str) {
      return new YGOProDeck().fromYdkString(str);
    }
    fromUpdateDeckPayload(buf, isExtraDeckCard = () => false) {
      const reader = new BufferReader(buf);
      const mainc = reader.readUint32LE();
      const sidec = reader.readUint32LE();
      this.main = [];
      this.extra = [];
      this.side = [];
      for (let i = 0; i < mainc; i++) {
        const id = reader.readUint32LE();
        if (isExtraDeckCard(id, i, mainc)) {
          this.extra.push(id);
        } else {
          this.main.push(id);
        }
      }
      for (let i = 0; i < sidec; i++) {
        const id = reader.readUint32LE();
        this.side.push(id);
      }
      return this;
    }
    static fromUpdateDeckPayload(buf, isExtraDeckCard = () => false) {
      return new YGOProDeck().fromUpdateDeckPayload(buf, isExtraDeckCard);
    }
    toUpdateDeckPayload() {
      const cards = [...this.main, ...this.extra, ...this.side];
      const writer = new BufferWriter(cards.length * 4 + 8).writeUint32LE(this.main.length + this.extra.length).writeUint32LE(this.side.length);
      cards.forEach((id) => writer.writeUint32LE(id));
      return writer.buffer;
    }
    fromYGOMobileDeckURL(uri) {
      const parsed = fromYGOMobileDeckURL(uri);
      this.main = parsed.main;
      this.extra = parsed.extra;
      this.side = parsed.side;
      this.name = parsed.name;
      return this;
    }
    static fromYGOMobileDeckURL(uri) {
      return new YGOProDeck().fromYGOMobileDeckURL(uri);
    }
    toYGOMobileDeckURL() {
      return toYGOMobileDeckURL(
        this.main,
        this.extra,
        this.side,
        this.name && {
          name: this.name
        }
      );
    }
    fromYdkeURL(uri) {
      const parsed = fromYdkeURL(uri);
      this.main = parsed.main;
      this.extra = parsed.extra;
      this.side = parsed.side;
      return this;
    }
    static fromYdkeURL(uri) {
      return new YGOProDeck().fromYdkeURL(uri);
    }
    toYdkeURL() {
      return toYdkeURL({
        main: this.main,
        extra: this.extra,
        side: this.side
      });
    }
    isEqual(other, options = {}) {
      const { ignoreOrder = false } = options;
      const fields = ["main", "extra", "side"];
      const getField = (o, field) => o[field] || [];
      if (fields.some(
        (field) => getField(this, field).length !== getField(other, field).length
      )) {
        return false;
      }
      const normalize = (arr) => ignoreOrder ? [...arr].sort((a, b) => a - b) : arr;
      return fields.every(
        (field) => arrayEquals(
          normalize(getField(this, field)),
          normalize(getField(other, field))
        )
      );
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/lz-window.js
  var LzOutWindow = class {
    buffer = null;
    pos = 0;
    streamPos = 0;
    stream = null;
    windowSize = 0;
    // Private Go-style properties
    w = null;
    buf;
    constructor(writer = null, windowSize = 4096) {
      this.w = writer;
      this.stream = writer;
      this.windowSize = windowSize;
      this.buf = new Uint8Array(windowSize);
      this.buffer = this.buf;
      this.pos = 0;
      this.streamPos = 0;
    }
    /**
     * Copy a block of data from a previous position (LZ77-style)
     */
    copyBlock(distance, length) {
      if (!this.buffer)
        return;
      for (let i = 0; i < length; i++) {
        let sourcePos = this.pos - distance - 1;
        if (sourcePos < 0) {
          sourcePos += this.windowSize;
        }
        const byte = this.buffer[sourcePos];
        this.putByte(byte);
      }
    }
    /**
     * Put a single byte into the window
     */
    putByte(byte) {
      if (!this.buffer)
        return;
      this.buffer[this.pos] = byte;
      this.pos++;
      this.streamPos++;
      if (this.pos >= this.windowSize) {
        this.flush();
      }
    }
    /**
     * Get a byte from a relative position
     */
    getByte(relativePos) {
      if (!this.buffer)
        return 0;
      let pos = this.pos + relativePos;
      if (pos < 0) {
        pos += this.windowSize;
      } else if (pos >= this.windowSize) {
        pos -= this.windowSize;
      }
      return this.buffer[pos];
    }
    /**
     * Flush buffered data to output writer
     */
    flush() {
      if (this.w && this.buffer && this.pos > 0) {
        this.w.writeBytes(this.buffer, 0, this.pos);
        this.pos = 0;
      }
    }
    /**
     * Check if the window is empty
     */
    isEmpty() {
      return this.streamPos === 0;
    }
    /**
     * Reset the window
     */
    reset() {
      this.pos = 0;
      this.streamPos = 0;
      if (this.buffer) {
        this.buffer.fill(0);
      }
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/range-decoder.js
  var RangeDecoder = class {
    stream = null;
    code = 0;
    rrange = 0;
    /**
     * Set input stream for decoding
     */
    setStream(stream) {
      this.stream = stream;
    }
    /**
     * Initialize range decoder
     */
    init() {
      this.code = 0;
      this.rrange = -1;
      for (let i = 0; i < 5; ++i) {
        this.code = this.code << 8 | this.readFromStream();
      }
    }
    /**
     * Decode a single bit using probability model
     */
    decodeBit(probs, index) {
      let newBound, prob = probs[index];
      newBound = (this.rrange >>> 11) * prob;
      if ((this.code ^ -2147483648) < (newBound ^ -2147483648)) {
        this.rrange = newBound;
        probs[index] = prob + (2048 - prob >>> 5);
        if (!(this.rrange & -16777216)) {
          this.code = this.code << 8 | this.readFromStream();
          this.rrange <<= 8;
        }
        return 0;
      } else {
        this.rrange -= newBound;
        this.code -= newBound;
        probs[index] = prob - (prob >>> 5);
        if (!(this.rrange & -16777216)) {
          this.code = this.code << 8 | this.readFromStream();
          this.rrange <<= 8;
        }
        return 1;
      }
    }
    /**
     * Decode direct bits (without probability model)
     */
    decodeDirectBits(numTotalBits) {
      let result = 0;
      for (let i = numTotalBits; i != 0; i -= 1) {
        this.rrange >>>= 1;
        let t = this.code - this.rrange >>> 31;
        this.code -= this.rrange & t - 1;
        result = result << 1 | 1 - t;
        if (!(this.rrange & -16777216)) {
          this.code = this.code << 8 | this.readFromStream();
          this.rrange <<= 8;
        }
      }
      return result;
    }
    /**
     * Get current code value (for compatibility)
     */
    get currentCode() {
      return this.code;
    }
    /**
     * Get current range value (for compatibility)
     */
    get currentRange() {
      return this.rrange;
    }
    /**
     * Read a single byte from the input stream
     */
    readFromStream() {
      if (!this.stream) {
        return 0;
      }
      return this.stream.readByte();
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/utils.js
  var INFINITY_PRICE = 268435455;
  var _MAX_UINT32 = 4294967295;
  var DICTIONARY_SIZE_THRESHOLD = 1073741823;
  var kTopValue = 1 << 24;
  var kNumBitModelTotalBits = 11;
  var kBitModelTotal = 1 << kNumBitModelTotalBits;
  var MATCH_DECODERS_SIZE = 192;
  var REP_DECODERS_SIZE = 12;
  var POS_DECODERS_SIZE = 114;
  var LITERAL_DECODER_SIZE = 768;
  var DEFAULT_WINDOW_SIZE = 4096;
  var CHOICE_ARRAY_SIZE = 2;
  var CRC32_TABLE = [
    0,
    1996959894,
    3993919788,
    2567524794,
    124634137,
    1886057615,
    3915621685,
    2657392035,
    249268274,
    2044508324,
    3772115230,
    2547177864,
    162941995,
    2125561021,
    3887607047,
    2428444049,
    498536548,
    1789927666,
    4089016648,
    2227061214,
    450548861,
    1843258603,
    4107580753,
    2211677639,
    325883990,
    1684777152,
    4251122042,
    2321926636,
    335633487,
    1661365465,
    4195302755,
    2366115317,
    997073096,
    1281953886,
    3579855332,
    2724688242,
    1006888145,
    1258607687,
    3524101629,
    2768942443,
    901097722,
    1119000684,
    3686517206,
    2898065728,
    853044451,
    1172266101,
    3705015759,
    2882616665,
    651767980,
    1373503546,
    3369554304,
    3218104598,
    565507253,
    1454621731,
    3485111705,
    3099436303,
    671266974,
    1594198024,
    3322730930,
    2970347812,
    795835527,
    1483230225,
    3244367275,
    3060149565,
    1994146192,
    31158534,
    2563907772,
    4023717930,
    1907459465,
    112637215,
    2680153253,
    3904427059,
    2013776290,
    251722036,
    2517215374,
    3775830040,
    2137656763,
    141376813,
    2439277719,
    3865271297,
    1802195444,
    476864866,
    2238001368,
    4066508878,
    1812370925,
    453092731,
    2181625025,
    4111451223,
    1706088902,
    314042704,
    2344532202,
    4240017532,
    1658658271,
    366619977,
    2362670323,
    4224994405,
    1303535960,
    984961486,
    2747007092,
    3569037538,
    1256170817,
    1037604311,
    2765210733,
    3554079995,
    1131014506,
    879679996,
    2909243462,
    3663771856,
    1141124467,
    855842277,
    2852801631,
    3708648649,
    1342533948,
    654459306,
    3188396048,
    3373015174,
    1466479909,
    544179635,
    3110523913,
    3462522015,
    1591671054,
    702138776,
    2966460450,
    3352799412,
    1504918807,
    783551873,
    3082640443,
    3233442989,
    3988292384,
    2596254646,
    62317068,
    1957810842,
    3939845945,
    2647816111,
    81470997,
    1943803523,
    3814918930,
    2489596804,
    225274430,
    2053790376,
    3826175755,
    2466906013,
    167816743,
    2097651377,
    4027552580,
    2265490386,
    503444072,
    1762050814,
    4150417245,
    2154129355,
    426522225,
    1852507879,
    4275313526,
    2312317920,
    282753626,
    1742555852,
    4189708143,
    2394877945,
    397917763,
    1622183637,
    3604390888,
    2714866558,
    953729732,
    1340076626,
    3518719985,
    2797360999,
    1068828381,
    1219638859,
    3624741850,
    2936675148,
    906185462,
    1090812512,
    3747672003,
    2825379669,
    829329135,
    1181335161,
    3412177804,
    3160834842,
    628085408,
    1382605366,
    3423369109,
    3138078467,
    570562233,
    1426400815,
    3317316542,
    2998733608,
    733239954,
    1555261956,
    3268935591,
    3050360625,
    752459403,
    1541320221,
    2607071920,
    3965973030,
    1969922972,
    40735498,
    2617837225,
    3943577151,
    1913087877,
    83908371,
    2512341634,
    3803740692,
    2075208622,
    213261112,
    2463272603,
    3855990285,
    2094854071,
    198958881,
    2262029012,
    4057260610,
    1759359992,
    534414190,
    2176718541,
    4139329115,
    1873836001,
    414664567,
    2282248934,
    4279200368,
    1711684554,
    285281116,
    2405801727,
    4167216745,
    1634467795,
    376229701,
    2685067896,
    3608007406,
    1308918612,
    956543938,
    2808555105,
    3495958263,
    1231636301,
    1047427035,
    2932959818,
    3654703836,
    1088359270,
    936918e3,
    2847714899,
    3736837829,
    1202900863,
    817233897,
    3183342108,
    3401237130,
    1404277552,
    615818150,
    3134207493,
    3453421203,
    1423857449,
    601450431,
    3009837614,
    3294710456,
    1567103746,
    711928724,
    3020668471,
    3272380065,
    1510334235,
    755167117
  ];
  var PROB_PRICES = createProbPrices();
  var G_FAST_POS = createFastPos();
  function initArray(len, value = 0) {
    const array = [];
    array[len - 1] = void 0;
    if (value !== 0) {
      for (let i = 0; i < len; i++) {
        array[i] = value;
      }
    }
    return array;
  }
  function getBitPrice(probability, bit) {
    return PROB_PRICES[((probability - bit ^ -bit) & 2047) >>> 2];
  }
  function initBitModels(probs) {
    for (let i = probs.length - 1; i >= 0; --i) {
      probs[i] = 1024;
    }
  }
  function getLenToPosState(len) {
    len -= 2;
    if (len < 4) {
      return len;
    }
    return 3;
  }
  var STATE_UPDATE_CHAR_TABLE = [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 4, 5];
  function stateUpdateChar(index) {
    if (index >= 0 && index < STATE_UPDATE_CHAR_TABLE.length) {
      return STATE_UPDATE_CHAR_TABLE[index];
    }
    if (index < 4) {
      return 0;
    }
    if (index < 10) {
      return index - 3;
    }
    return index - 6;
  }
  function createBitTree(numBitLevels) {
    return {
      numBitLevels,
      models: initArray(1 << numBitLevels)
    };
  }
  function createProbPrices() {
    const probPrices = [];
    for (let i = 8; i >= 0; --i) {
      let start = 1 << 9 - i - 1;
      let end = 1 << 9 - i;
      for (let j = start; j < end; ++j) {
        probPrices[j] = (i << 6) + (end - j << 6 >>> 9 - i - 1);
      }
    }
    return probPrices;
  }
  function createFastPos() {
    const gFastPos = [0, 1];
    let c = 2;
    for (let slotFast = 2; slotFast < 22; ++slotFast) {
      let k = 1 << (slotFast >> 1) - 1;
      for (let j = 0; j < k; ++j, ++c) {
        gFastPos[c] = slotFast;
      }
    }
    return gFastPos;
  }

  // ../ws-probe/node_modules/@cjser/lzma1/lib/decoder.js
  var Decoder = class {
    rangeDecoder;
    outWindow;
    // Decoder state
    state = 0;
    rep0 = 0;
    rep1 = 0;
    rep2 = 0;
    rep3 = 0;
    prevByte = 0;
    nowPos64 = 0n;
    outSize = 0n;
    // Decoder configuration
    posStateMask = 0;
    dictSizeCheck = 0;
    // Probability models for different symbols
    matchDecoders = [];
    rep0LongDecoders = [];
    repDecoders = [];
    repG0Decoders = [];
    repG1Decoders = [];
    repG2Decoders = [];
    posDecoders = [];
    // Complex decoders
    literalDecoder;
    posSlotDecoders = [];
    lenDecoder;
    repLenDecoder;
    posAlignDecoder;
    // Alias for compatibility with LZMA class
    get literalCoder() {
      return this.literalDecoder;
    }
    constructor() {
      this.rangeDecoder = new RangeDecoder();
      this.outWindow = new LzOutWindow(null, DEFAULT_WINDOW_SIZE);
      this.matchDecoders = initArray(MATCH_DECODERS_SIZE);
      this.rep0LongDecoders = initArray(MATCH_DECODERS_SIZE);
      this.repDecoders = initArray(REP_DECODERS_SIZE);
      this.repG0Decoders = initArray(REP_DECODERS_SIZE);
      this.repG1Decoders = initArray(REP_DECODERS_SIZE);
      this.repG2Decoders = initArray(REP_DECODERS_SIZE);
      this.posDecoders = initArray(POS_DECODERS_SIZE);
      this.literalDecoder = {
        coders: [],
        numPrevBits: 0,
        numPosBits: 0,
        posMask: 0,
        init: () => this.initLiteralDecoder()
      };
      for (let i = 0; i < 4; i++) {
        this.posSlotDecoders[i] = createBitTree(6);
      }
      this.lenDecoder = this.createLenDecoder();
      this.repLenDecoder = this.createLenDecoder();
      this.posAlignDecoder = createBitTree(4);
    }
    /**
     * Read LZMA header, configure decoder, and prepare for decompression.
     */
    initDecompression(input, output) {
      const properties = [];
      for (let i = 0; i < 5; ++i) {
        const r = input.readByte();
        if (r === -1) {
          throw new Error("truncated input");
        }
        properties[i] = r << 24 >> 24;
      }
      if (!this.setDecoderProperties(properties)) {
        throw new Error("corrupted input");
      }
      let outSize;
      {
        let value = 0n;
        for (let i = 0; i < 8; i++) {
          const r = input.readByte();
          if (r === -1) {
            throw new Error("truncated input");
          }
          value += BigInt(r & 255) << BigInt(i * 8);
        }
        if (value === 0xffffffffffffffffn) {
          outSize = -1n;
        } else if (value > BigInt(_MAX_UINT32)) {
          outSize = -1n;
        } else {
          outSize = value;
        }
      }
      this.rangeDecoder.setStream(input);
      this.flush();
      this.outWindow.stream = null;
      this.outWindow.stream = output;
      this.init();
      this.state = 0;
      this.rep0 = 0;
      this.rep1 = 0;
      this.rep2 = 0;
      this.rep3 = 0;
      this.outSize = outSize;
      this.nowPos64 = 0n;
      this.prevByte = 0;
    }
    /**
     * Full decompression: read header, decode all chunks, flush and cleanup.
     */
    decompress(input, output) {
      this.initDecompression(input, output);
      while (true) {
        const result = this.codeOneChunk();
        if (result === -1) {
          throw new Error("corrupted input");
        }
        const isOutputComplete = this.outSize >= 0n && this.nowPos64 >= this.outSize;
        if (result || isOutputComplete) {
          this.flush();
          this.cleanup();
          return;
        }
      }
    }
    createLenDecoder() {
      const decoder = {
        choice: initArray(CHOICE_ARRAY_SIZE),
        lowCoder: [],
        midCoder: [],
        highCoder: createBitTree(8),
        numPosStates: 0
      };
      return decoder;
    }
    setDecoderProperties(properties) {
      if (properties.length < 5) {
        return false;
      }
      const lc = properties[0] % 9;
      const remainder = Math.floor(properties[0] / 9);
      const lp = remainder % 5;
      const pb = Math.floor(remainder / 5);
      if (pb > 4) {
        return false;
      }
      this.literalDecoder.numPrevBits = lc;
      this.literalDecoder.numPosBits = lp;
      this.literalDecoder.posMask = (1 << lp) - 1;
      this.posStateMask = (1 << pb) - 1;
      let dictSize = 0;
      for (let i = 0; i < 4; i++) {
        const unsignedByte = properties[1 + i] & 255;
        dictSize += unsignedByte << i * 8;
      }
      this.dictSizeCheck = Math.max(dictSize, 1);
      if (dictSize > 0) {
        this.outWindow.windowSize = Math.max(dictSize, 4096);
        this.outWindow.buffer = new Uint8Array(this.outWindow.windowSize);
      }
      const numStates = 1 << this.literalDecoder.numPrevBits + this.literalDecoder.numPosBits;
      this.literalDecoder.coders = [];
      for (let i = 0; i < numStates; i++) {
        this.literalDecoder.coders[i] = {
          decoders: initArray(LITERAL_DECODER_SIZE)
          // 0x300
        };
      }
      this.lenDecoder.numPosStates = 1 << pb;
      this.repLenDecoder.numPosStates = 1 << pb;
      this.lenDecoder.lowCoder = [];
      this.lenDecoder.midCoder = [];
      this.repLenDecoder.lowCoder = [];
      this.repLenDecoder.midCoder = [];
      for (let posState = 0; posState < 1 << pb; posState++) {
        this.lenDecoder.lowCoder[posState] = createBitTree(3);
        this.lenDecoder.midCoder[posState] = createBitTree(3);
        this.repLenDecoder.lowCoder[posState] = createBitTree(3);
        this.repLenDecoder.midCoder[posState] = createBitTree(3);
      }
      return true;
    }
    // Methods that modify decoder state
    copyBlock(len) {
      const outputWindow = this.outWindow;
      const distance = this.rep0;
      let pos = outputWindow.pos - distance - 1;
      if (pos < 0) {
        pos += outputWindow.windowSize;
      }
      for (; len != 0; len -= 1) {
        if (pos >= outputWindow.windowSize) {
          pos = 0;
        }
        outputWindow.buffer[outputWindow.pos] = outputWindow.buffer[pos];
        outputWindow.pos += 1;
        pos += 1;
        if (outputWindow.pos >= outputWindow.windowSize) {
          this.flush();
        }
      }
    }
    putByte(b) {
      this.outWindow.buffer[this.outWindow.pos] = b;
      this.outWindow.pos += 1;
      if (this.outWindow.pos >= this.outWindow.windowSize) {
        this.flush();
      }
    }
    getByte(distance) {
      const outputWindow = this.outWindow;
      let pos = outputWindow.pos - distance - 1;
      if (pos < 0) {
        pos += outputWindow.windowSize;
      }
      return outputWindow.buffer[pos];
    }
    getDecoder(pos, prevByte) {
      const positionMask = pos & this.literalDecoder.posMask;
      const prevBitsMask = (prevByte & 255) >>> 8 - this.literalDecoder.numPrevBits;
      const index = (positionMask << this.literalDecoder.numPrevBits) + prevBitsMask;
      return this.literalDecoder.coders[index];
    }
    initLiteralDecoder() {
      let numStates = 1 << this.literalDecoder.numPrevBits + this.literalDecoder.numPosBits;
      for (let i = 0; i < numStates; ++i) {
        for (let j = 0; j < this.literalDecoder.coders[i].decoders.length; j++) {
          this.literalDecoder.coders[i].decoders[j] = 1024;
        }
      }
    }
    init() {
      this.outWindow.streamPos = 0;
      this.outWindow.pos = 0;
      initBitModels(this.matchDecoders);
      initBitModels(this.rep0LongDecoders);
      initBitModels(this.repDecoders);
      initBitModels(this.repG0Decoders);
      initBitModels(this.repG1Decoders);
      initBitModels(this.repG2Decoders);
      initBitModels(this.posDecoders);
      this.initLiteralDecoder();
      for (let i = 0; i < 4; ++i) {
        initBitModels(this.posSlotDecoders[i].models);
      }
      this.initLenDecoder(this.lenDecoder);
      this.initLenDecoder(this.repLenDecoder);
      initBitModels(this.posAlignDecoder.models);
      this.initRangeDecoder();
    }
    initLenDecoder(decoder) {
      initBitModels(decoder.choice);
      for (let posState = 0; posState < decoder.numPosStates; ++posState) {
        initBitModels(decoder.lowCoder[posState].models);
        initBitModels(decoder.midCoder[posState].models);
      }
      initBitModels(decoder.highCoder.models);
    }
    outWindowReleaseStream() {
      this.flush();
      this.outWindow.stream = null;
    }
    decodeBit(probs, index) {
      return this.rangeDecoder.decodeBit(probs, index);
    }
    decodeDirectBits(numTotalBits) {
      return this.rangeDecoder.decodeDirectBits(numTotalBits);
    }
    initRangeDecoder() {
      this.rangeDecoder.init();
    }
    rangeBitTreeDecoder(bitTree) {
      let bitIndex, m = 1;
      for (bitIndex = bitTree.numBitLevels; bitIndex != 0; bitIndex -= 1) {
        m = (m << 1) + this.decodeBit(bitTree.models, m);
      }
      return m - (1 << bitTree.numBitLevels);
    }
    reverseDecode(models, startIndex, numBitLevels) {
      let symbol = 0;
      for (let bitIndex = 0, m = 1, bit; bitIndex < numBitLevels; ++bitIndex) {
        bit = this.decodeBit(models, startIndex + m);
        m <<= 1;
        m += bit;
        symbol |= bit << bitIndex;
      }
      return symbol;
    }
    reverseDecodeAlignDecoder() {
      let symbol = 0;
      for (let m = 1, bitIndex = 0, bit; bitIndex < this.posAlignDecoder.numBitLevels; ++bitIndex) {
        bit = this.decodeBit(this.posAlignDecoder.models, m);
        m <<= 1;
        m += bit;
        symbol |= bit << bitIndex;
      }
      return symbol;
    }
    // Update the placeholder implementations with actual logic
    decodeNormalWithRangeDecoder(decoder) {
      let symbol = 1;
      do {
        symbol = symbol << 1 | this.decodeBit(decoder.decoders, symbol);
      } while (symbol < 256);
      return symbol << 24 >> 24;
    }
    decodeWithMatchByteWithRangeDecoder(encoder, matchByte) {
      let bit, matchBit, symbol = 1;
      do {
        matchBit = matchByte >> 7 & 1;
        matchByte <<= 1;
        bit = this.decodeBit(encoder.decoders, (1 + matchBit << 8) + symbol);
        symbol = symbol << 1 | bit;
        if (matchBit != bit) {
          while (symbol < 256) {
            symbol = symbol << 1 | this.decodeBit(encoder.decoders, symbol);
          }
          break;
        }
      } while (symbol < 256);
      return symbol << 24 >> 24;
    }
    decodeLenWithRangeDecoder(decoder, posState) {
      if (!this.decodeBit(decoder.choice, 0)) {
        return this.rangeBitTreeDecoder(decoder.lowCoder[posState]);
      }
      let symbol = 8;
      if (!this.decodeBit(decoder.choice, 1)) {
        symbol += this.rangeBitTreeDecoder(decoder.midCoder[posState]);
      } else {
        symbol += 8 + this.rangeBitTreeDecoder(decoder.highCoder);
      }
      return symbol;
    }
    codeOneChunk() {
      let decoder2, distance, len, numDirectBits, positionSlot;
      let posState = Number(this.nowPos64 & 0xffffffffn) & this.posStateMask;
      if (!this.decodeBit(this.matchDecoders, (this.state << 4) + posState)) {
        decoder2 = this.getDecoder(Number(this.nowPos64 & 0xffffffffn), this.prevByte);
        if (this.state < 7) {
          this.prevByte = this.decodeNormalWithRangeDecoder(decoder2);
        } else {
          this.prevByte = this.decodeWithMatchByteWithRangeDecoder(decoder2, this.getByte(this.rep0));
        }
        this.putByte(this.prevByte);
        this.state = stateUpdateChar(this.state);
        this.nowPos64 += 1n;
      } else {
        if (this.decodeBit(this.repDecoders, this.state)) {
          len = 0;
          if (!this.decodeBit(this.repG0Decoders, this.state)) {
            if (!this.decodeBit(this.rep0LongDecoders, (this.state << 4) + posState)) {
              this.state = this.state < 7 ? 9 : 11;
              len = 1;
            }
          } else {
            if (!this.decodeBit(this.repG1Decoders, this.state)) {
              distance = this.rep1;
            } else {
              if (!this.decodeBit(this.repG2Decoders, this.state)) {
                distance = this.rep2;
              } else {
                distance = this.rep3;
                this.rep3 = this.rep2;
              }
              this.rep2 = this.rep1;
            }
            this.rep1 = this.rep0;
            this.rep0 = distance;
          }
          if (!len) {
            len = this.decodeLenWithRangeDecoder(this.repLenDecoder, posState) + 2;
            this.state = this.state < 7 ? 8 : 11;
          }
        } else {
          this.rep3 = this.rep2;
          this.rep2 = this.rep1;
          this.rep1 = this.rep0;
          len = 2 + this.decodeLenWithRangeDecoder(this.lenDecoder, posState);
          this.state = this.state < 7 ? 7 : 10;
          positionSlot = this.rangeBitTreeDecoder(this.posSlotDecoders[getLenToPosState(len)]);
          if (positionSlot >= 4) {
            numDirectBits = (positionSlot >> 1) - 1;
            this.rep0 = (2 | positionSlot & 1) << numDirectBits;
            if (positionSlot < 14) {
              this.rep0 += this.reverseDecode(this.posDecoders, this.rep0 - positionSlot - 1, numDirectBits);
            } else {
              this.rep0 += this.decodeDirectBits(numDirectBits - 4) << 4;
              this.rep0 += this.reverseDecodeAlignDecoder();
              if (this.rep0 < 0) {
                if (this.rep0 == -1) {
                  return 1;
                }
                return -1;
              }
            }
          } else {
            this.rep0 = positionSlot;
          }
        }
        if (BigInt(this.rep0) >= this.nowPos64 || this.rep0 >= this.dictSizeCheck) {
          return -1;
        }
        this.copyBlock(len);
        this.nowPos64 += BigInt(len);
        this.prevByte = this.getByte(0);
      }
      return 0;
    }
    writeToOutput(buffer, data, offset, length) {
      buffer.writeBytes(data, offset, length);
    }
    flush() {
      const size = this.outWindow.pos - this.outWindow.streamPos;
      if (!size) {
        return;
      }
      if (this.outWindow.stream && this.outWindow.buffer) {
        this.outWindow.stream.writeBytes(this.outWindow.buffer, this.outWindow.streamPos, size);
      }
      if (this.outWindow.pos >= this.outWindow.windowSize) {
        this.outWindow.pos = 0;
      }
      this.outWindow.streamPos = this.outWindow.pos;
    }
    /**
     * Cleanup decoder resources
     */
    cleanup() {
      this.outWindow.stream = null;
      this.rangeDecoder.stream = null;
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/len-coder.js
  var LenEncoder = class {
    // Choice probability arrays for length range selection
    choice = initArray(2);
    // Low range coders (for lengths 2-9)
    lowCoder = [];
    // Mid range coders (for lengths 10-17)
    midCoder = [];
    // High range coder (for lengths 18+)
    highCoder = createBitTree(8);
    // Price optimization properties
    tableSize = 0;
    prices = [];
    counters = [];
    constructor() {
      for (let posState = 0; posState < 16; ++posState) {
        this.lowCoder[posState] = createBitTree(3);
        this.midCoder[posState] = createBitTree(3);
      }
    }
    /**
     * Initialize the encoder with specified number of position states
     */
    init(numPosStates) {
      initBitModels(this.choice);
      for (let posState = 0; posState < numPosStates; ++posState) {
        initBitModels(this.lowCoder[posState].models);
        initBitModels(this.midCoder[posState].models);
      }
      initBitModels(this.highCoder.models);
    }
    /**
     * Encode a length value using the provided range encoder
     */
    encode(symbol, posState, rangeEncoder) {
      if (symbol < 8) {
        rangeEncoder.encodeBit(this.choice, 0, 0);
        rangeEncoder.encodeBitTree(this.lowCoder[posState], symbol);
      } else {
        symbol -= 8;
        rangeEncoder.encodeBit(this.choice, 0, 1);
        if (symbol < 8) {
          rangeEncoder.encodeBit(this.choice, 1, 0);
          rangeEncoder.encodeBitTree(this.midCoder[posState], symbol);
        } else {
          rangeEncoder.encodeBit(this.choice, 1, 1);
          rangeEncoder.encodeBitTree(this.highCoder, symbol - 8);
        }
      }
    }
    /**
     * Encode with price table update
     */
    encodeWithUpdate(symbol, posState, rangeEncoder) {
      this.encode(symbol, posState, rangeEncoder);
      if (this.counters && (this.counters[posState] -= 1) == 0) {
        this.counters[posState] = this.tableSize;
      }
    }
    /**
     * Get price for encoding a symbol at the given position state
     */
    getPrice(symbol, posState) {
      return this.prices[posState * 272 + symbol];
    }
    /**
     * Initialize as a price table encoder
     */
    initPriceTable() {
      this.prices = [];
      this.counters = [];
    }
    /**
     * Set table size for price optimization
     */
    setTableSize(size) {
      this.tableSize = size;
    }
    /**
     * Set table size and update internal counters
     */
    setTableSizeAndInitCounters(size, numPosStates) {
      this.tableSize = size;
      if (this.counters) {
        for (let posState = 0; posState < numPosStates; ++posState) {
          this.counters[posState] = size;
        }
      }
    }
    /**
     * Get table size
     */
    getTableSize() {
      return this.tableSize;
    }
    /**
     * Update price tables for all position states
     */
    updateTables(numPosStates) {
      if (!this.prices || !this.counters) {
        this.initPriceTable();
      }
      for (let posState = 0; posState < numPosStates; ++posState) {
        this.setPrices(posState, this.tableSize, this.prices, 0);
        if (this.counters) {
          this.counters[posState] = this.tableSize;
        }
      }
    }
    // Private methods for internal state management
    /**
     * Calculate price for bit tree encoder
     */
    getBitTreePrice(encoder, symbol) {
      let bit, bitIndex, m = 1, price = 0;
      for (bitIndex = encoder.numBitLevels; bitIndex != 0; ) {
        bitIndex -= 1;
        bit = symbol >>> bitIndex & 1;
        price += this.getBitPrice(encoder.models[m], bit);
        m = (m << 1) + bit;
      }
      return price;
    }
    /**
     * Get price for a single bit
     */
    getBitPrice(prob, symbol) {
      return getBitPrice(prob, symbol);
    }
    /**
     * Set prices for all symbols in a position state range
     */
    setPrices(posState, numSymbols, prices, priceIndex) {
      const a0 = this.getBitPrice(this.choice[0], 0);
      const a1 = this.getBitPrice(this.choice[0], 1);
      const b0 = a1 + this.getBitPrice(this.choice[1], 0);
      const b1 = a1 + this.getBitPrice(this.choice[1], 1);
      let i = 0;
      const st = priceIndex + posState * 272;
      for (i = 0; i < 8; ++i) {
        if (i >= numSymbols)
          return;
        prices[st + i] = a0 + this.getBitTreePrice(this.lowCoder[posState], i);
      }
      for (; i < 16; ++i) {
        if (i >= numSymbols)
          return;
        prices[st + i] = b0 + this.getBitTreePrice(this.midCoder[posState], i - 8);
      }
      for (; i < numSymbols; ++i) {
        prices[st + i] = b1 + this.getBitTreePrice(this.highCoder, i - 8 - 8);
      }
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/lit-coder.js
  var LitSubCoder = class {
    coders;
    constructor() {
      this.coders = initArray(768, 1024);
    }
    /**
     * Decode normal literal symbol
     */
    decodeNormal(rd) {
      let symbol = 1;
      while (symbol < 256) {
        const i = rd.decodeBit(this.coders, symbol);
        symbol = symbol << 1 | i;
      }
      return symbol & 255;
    }
    /**
     * Decode literal symbol with match byte context
     */
    decodeWithMatchByte(rd, matchByte) {
      let uMatchByte = matchByte;
      let symbol = 1;
      while (symbol < 256) {
        const matchBit = uMatchByte >> 7 & 1;
        uMatchByte <<= 1;
        const bit = rd.decodeBit(this.coders, (1 + matchBit << 8) + symbol);
        symbol = symbol << 1 | bit;
        if (matchBit !== bit) {
          while (symbol < 256) {
            const i = rd.decodeBit(this.coders, symbol);
            symbol = symbol << 1 | i;
          }
          break;
        }
      }
      return symbol & 255;
    }
    /**
     * Encode literal symbol
     */
    encode(re, symbol) {
      let context = 1;
      for (let i = 7; i >= 0; i--) {
        const bit = symbol >> i & 1;
        re.encodeBit(this.coders, context, bit);
        context = context << 1 | bit;
      }
    }
    /**
     * Encode literal symbol with match byte context
     */
    encodeMatched(re, matchByte, symbol) {
      let uMatchByte = matchByte;
      let context = 1;
      let same = true;
      for (let i = 7; i >= 0; i--) {
        const bit = symbol >> i & 1;
        let state = context;
        if (same) {
          const matchBit = uMatchByte >> i & 1;
          state += 1 + matchBit << 8;
          same = matchBit === bit;
        }
        re.encodeBit(this.coders, state, bit);
        context = context << 1 | bit;
      }
    }
    /**
     * Get price for encoding literal symbol
     */
    getPrice(matchMode, matchByte, symbol) {
      let uMatchByte = matchByte;
      let price = 0;
      let context = 1;
      let i = 7;
      if (matchMode) {
        while (i >= 0) {
          const matchBit = uMatchByte >> i & 1;
          const bit = symbol >> i & 1;
          price += getBitPrice(this.coders[1 + matchBit << 8 + context], bit);
          context = context << 1 | bit;
          if (matchBit !== bit) {
            i--;
            break;
          }
          i--;
        }
      }
      while (i >= 0) {
        const bit = symbol >> i & 1;
        price += getBitPrice(this.coders[context], bit);
        context = context << 1 | bit;
        i--;
      }
      return price;
    }
    /**
     * Reset coder to initial state
     */
    reset() {
      this.coders.fill(1024);
    }
    /**
     * Get decoders array (for compatibility with LiteralDecoderEncoder2)
     */
    get decoders() {
      return this.coders;
    }
  };
  var LitCoder = class {
    _coders;
    _numPrevBits;
    _posMask;
    constructor(numPosBits, numPrevBits) {
      const numStates = 1 << numPrevBits + numPosBits;
      this._coders = [];
      this._numPrevBits = numPrevBits;
      this._posMask = (1 << numPosBits) - 1;
      for (let i = 0; i < numStates; i++) {
        this._coders[i] = new LitSubCoder();
      }
    }
    /**
     * Get sub-coder for position and previous byte
     */
    getSubCoder(pos, prevByte) {
      return this._coders[((pos & this._posMask) << this._numPrevBits) + (prevByte >> 8 - this._numPrevBits)];
    }
    /**
     * Reset all sub-coders
     */
    reset() {
      this._coders.forEach((coder) => coder.reset());
    }
    /**
     * Get number of previous bits (for compatibility)
     */
    get numPrevBits() {
      return this._numPrevBits;
    }
    /**
     * Get number of position bits (for compatibility)
     */
    get numPosBits() {
      return Math.log2(this._posMask + 1);
    }
    /**
     * Get position mask (for compatibility)
     */
    get posMask() {
      return this._posMask;
    }
    /**
     * Get coders array (for compatibility)
     */
    get coders() {
      return this._coders;
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/match-finder.js
  var BinTreeMatchFinder = class {
    // Input window fields
    _posLimit = 0;
    _bufferBase = new Uint8Array(0);
    _pos = 0;
    _streamPos = 0;
    _streamEndWasReached = 0;
    _bufferOffset = 0;
    _blockSize = 0;
    _keepSizeBefore = 0;
    _keepSizeAfter = 0;
    _pointerToLastSafePosition = 0;
    _stream = null;
    // Hash and tree fields
    HASH_ARRAY = true;
    kNumHashDirectBytes = 0;
    kMinMatchCheck = 4;
    kFixHashSize = 66560;
    _hashMask = 0;
    _hashSizeSum = 0;
    _hash = new Int32Array(0);
    _cyclicBufferSize = 0;
    _cyclicBufferPos = 0;
    _son = new Int32Array(0);
    _matchMaxLen = 0;
    _cutValue = 255;
    // --- LzInWindow methods ---
    getIndexByte(index) {
      return this._bufferBase[this._bufferOffset + this._pos + index];
    }
    getMatchLen(index, distance, limit) {
      if (this._streamEndWasReached) {
        if (this._pos + index + limit > this._streamPos) {
          limit = this._streamPos - (this._pos + index);
        }
      }
      ++distance;
      let i;
      const pby = this._bufferOffset + this._pos + index;
      for (i = 0; i < limit && this._bufferBase[pby + i] == this._bufferBase[pby + i - distance]; ++i)
        ;
      return i;
    }
    getNumAvailableBytes() {
      return this._streamPos - this._pos;
    }
    moveBlock() {
      let offset = this._bufferOffset + this._pos - this._keepSizeBefore;
      if (offset > 0) {
        --offset;
      }
      const numBytes = this._bufferOffset + this._streamPos - offset;
      this._bufferBase.copyWithin(0, offset, offset + numBytes);
      this._bufferOffset -= offset;
    }
    movePosInWindow() {
      this._pos += 1;
      if (this._pos > this._posLimit) {
        const pointerToPosition = this._bufferOffset + this._pos;
        if (pointerToPosition > this._pointerToLastSafePosition) {
          this.moveBlock();
        }
        this.readBlock();
      }
    }
    readBlock() {
      if (this._streamEndWasReached) {
        return;
      }
      while (true) {
        const size = -this._bufferOffset + this._blockSize - this._streamPos;
        if (!size) {
          return;
        }
        const bytesRead = this.readFromStream(this._bufferOffset + this._streamPos, size);
        if (bytesRead == -1) {
          this._posLimit = this._streamPos;
          const pointerToPosition = this._bufferOffset + this._posLimit;
          if (pointerToPosition > this._pointerToLastSafePosition) {
            this._posLimit = this._pointerToLastSafePosition - this._bufferOffset;
          }
          this._streamEndWasReached = 1;
          return;
        }
        this._streamPos += bytesRead;
        if (this._streamPos >= this._pos + this._keepSizeAfter) {
          this._posLimit = this._streamPos - this._keepSizeAfter;
        }
      }
    }
    reduceOffsets(subValue) {
      this._bufferOffset += subValue;
      this._posLimit -= subValue;
      this._pos -= subValue;
      this._streamPos -= subValue;
    }
    readFromStream(off, len) {
      const stream = this._stream;
      const buffer = this._bufferBase;
      return stream.readBytes(buffer, off, len);
    }
    // --- Match finder configuration methods ---
    createBuffers(keepSizeBefore, keepSizeAfter, keepSizeReserv) {
      this._keepSizeBefore = keepSizeBefore;
      this._keepSizeAfter = keepSizeAfter;
      const blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv;
      if (this._blockSize != blockSize) {
        this._bufferBase = new Uint8Array(blockSize);
        this._blockSize = blockSize;
      }
      this._pointerToLastSafePosition = this._blockSize - keepSizeAfter;
    }
    create(dictionarySize, numFastBytes, keepAddBufferBefore, keepAddBufferAfter) {
      if (dictionarySize < DICTIONARY_SIZE_THRESHOLD) {
        this._cutValue = 16 + (numFastBytes >> 1);
        const windowReservSize = ~~((dictionarySize + keepAddBufferBefore + numFastBytes + keepAddBufferAfter) / 2) + 256;
        this.createBuffers(dictionarySize + keepAddBufferBefore, numFastBytes + keepAddBufferAfter, windowReservSize);
        this._matchMaxLen = numFastBytes;
        const cyclicBufferSize = dictionarySize + 1;
        if (this._cyclicBufferSize !== cyclicBufferSize) {
          this._cyclicBufferSize = cyclicBufferSize;
          this._son = new Int32Array(cyclicBufferSize * 2);
        }
        let hs = 65536;
        if (this.HASH_ARRAY) {
          hs = dictionarySize - 1;
          hs |= hs >> 1;
          hs |= hs >> 2;
          hs |= hs >> 4;
          hs |= hs >> 8;
          hs >>= 1;
          hs |= 65535;
          if (hs > 16777216) {
            hs >>= 1;
          }
          this._hashMask = hs;
          hs += 1;
          const finalHashSizeSum = hs + this.kFixHashSize;
          if (finalHashSizeSum !== this._hashSizeSum) {
            this._hashSizeSum = finalHashSizeSum;
            this._hash = new Int32Array(finalHashSizeSum);
          }
        } else {
          if (hs !== this._hashSizeSum) {
            this._hashSizeSum = hs;
            this._hash = new Int32Array(hs);
          }
        }
      }
    }
    // --- Match finding methods ---
    getMatches(distances) {
      let count, cur, curMatch, curMatch2, curMatch3, cyclicPos, delta, hash2Value, hash3Value, hashValue, len, len0, len1, lenLimit, matchMinPos, maxLen, offset, pby1, ptr0, ptr1, temp;
      if (this._pos + this._matchMaxLen <= this._streamPos) {
        lenLimit = this._matchMaxLen;
      } else {
        lenLimit = this._streamPos - this._pos;
        if (lenLimit < this.kMinMatchCheck) {
          this.movePos();
          return 0;
        }
      }
      offset = 0;
      matchMinPos = this._pos > this._cyclicBufferSize ? this._pos - this._cyclicBufferSize : 0;
      cur = this._bufferOffset + this._pos;
      maxLen = 1;
      hash2Value = 0;
      hash3Value = 0;
      if (this.HASH_ARRAY) {
        temp = CRC32_TABLE[this._bufferBase[cur]] ^ this._bufferBase[cur + 1];
        hash2Value = temp & 1023;
        temp ^= this._bufferBase[cur + 2] << 8;
        hash3Value = temp & 65535;
        hashValue = (temp ^ CRC32_TABLE[this._bufferBase[cur + 3]] << 5) & this._hashMask;
      } else {
        hashValue = this._bufferBase[cur] ^ this._bufferBase[cur + 1] << 8;
      }
      curMatch = this._hash[this.kFixHashSize + hashValue] || 0;
      if (this.HASH_ARRAY) {
        curMatch2 = this._hash[hash2Value] || 0;
        curMatch3 = this._hash[1024 + hash3Value] || 0;
        this._hash[hash2Value] = this._pos;
        this._hash[1024 + hash3Value] = this._pos;
        if (curMatch2 > matchMinPos) {
          if (this._bufferBase[this._bufferOffset + curMatch2] == this._bufferBase[cur]) {
            distances[offset++] = maxLen = 2;
            distances[offset++] = this._pos - curMatch2 - 1;
          }
        }
        if (curMatch3 > matchMinPos) {
          if (this._bufferBase[this._bufferOffset + curMatch3] == this._bufferBase[cur]) {
            if (curMatch3 == curMatch2) {
              offset -= 2;
            }
            distances[offset++] = maxLen = 3;
            distances[offset++] = this._pos - curMatch3 - 1;
            curMatch2 = curMatch3;
          }
        }
        if (offset != 0 && curMatch2 == curMatch) {
          offset -= 2;
          maxLen = 1;
        }
      }
      this._hash[this.kFixHashSize + hashValue] = this._pos;
      ptr0 = (this._cyclicBufferPos << 1) + 1;
      ptr1 = this._cyclicBufferPos << 1;
      len0 = len1 = this.kNumHashDirectBytes;
      if (this.kNumHashDirectBytes != 0) {
        if (curMatch > matchMinPos) {
          if (this._bufferBase[this._bufferOffset + curMatch + this.kNumHashDirectBytes] != this._bufferBase[cur + this.kNumHashDirectBytes]) {
            distances[offset++] = maxLen = this.kNumHashDirectBytes;
            distances[offset++] = this._pos - curMatch - 1;
          }
        }
      }
      count = this._cutValue;
      while (1) {
        if (curMatch <= matchMinPos || count == 0) {
          count -= 1;
          this._son[ptr0] = this._son[ptr1] = 0;
          break;
        }
        delta = this._pos - curMatch;
        cyclicPos = (delta <= this._cyclicBufferPos ? this._cyclicBufferPos - delta : this._cyclicBufferPos - delta + this._cyclicBufferSize) << 1;
        pby1 = this._bufferOffset + curMatch;
        len = len0 < len1 ? len0 : len1;
        if (this._bufferBase[pby1 + len] == this._bufferBase[cur + len]) {
          while ((len += 1) != lenLimit) {
            if (this._bufferBase[pby1 + len] != this._bufferBase[cur + len]) {
              break;
            }
          }
          if (maxLen < len) {
            distances[offset++] = maxLen = len;
            distances[offset++] = delta - 1;
            if (len == lenLimit) {
              this._son[ptr1] = this._son[cyclicPos];
              this._son[ptr0] = this._son[cyclicPos + 1];
              break;
            }
          }
        }
        if (this._bufferBase[pby1 + len] < this._bufferBase[cur + len]) {
          this._son[ptr1] = curMatch;
          ptr1 = cyclicPos + 1;
          curMatch = this._son[ptr1];
          len1 = len;
        } else {
          this._son[ptr0] = curMatch;
          ptr0 = cyclicPos;
          curMatch = this._son[ptr0];
          len0 = len;
        }
      }
      this.movePos();
      return offset;
    }
    skip(num) {
      let count, cur, curMatch, cyclicPos, delta, hash2Value, hash3Value, hashValue, len, len0, len1, lenLimit, matchMinPos, pby1, ptr0, ptr1, temp;
      do {
        if (this._pos + this._matchMaxLen <= this._streamPos) {
          lenLimit = this._matchMaxLen;
        } else {
          lenLimit = this._streamPos - this._pos;
          if (lenLimit < this.kMinMatchCheck) {
            this.movePos();
            continue;
          }
        }
        matchMinPos = this._pos > this._cyclicBufferSize ? this._pos - this._cyclicBufferSize : 0;
        cur = this._bufferOffset + this._pos;
        if (this.HASH_ARRAY) {
          temp = CRC32_TABLE[this._bufferBase[cur]] ^ this._bufferBase[cur + 1];
          hash2Value = temp & 1023;
          this._hash[hash2Value] = this._pos;
          temp ^= this._bufferBase[cur + 2] << 8;
          hash3Value = temp & 65535;
          this._hash[1024 + hash3Value] = this._pos;
          hashValue = (temp ^ CRC32_TABLE[this._bufferBase[cur + 3]] << 5) & this._hashMask;
        } else {
          hashValue = this._bufferBase[cur] ^ this._bufferBase[cur + 1] << 8;
        }
        curMatch = this._hash[this.kFixHashSize + hashValue];
        this._hash[this.kFixHashSize + hashValue] = this._pos;
        ptr0 = (this._cyclicBufferPos << 1) + 1;
        ptr1 = this._cyclicBufferPos << 1;
        len0 = len1 = this.kNumHashDirectBytes;
        count = this._cutValue;
        while (1) {
          if (curMatch <= matchMinPos || count == 0) {
            count -= 1;
            this._son[ptr0] = this._son[ptr1] = 0;
            break;
          }
          delta = this._pos - curMatch;
          cyclicPos = (delta <= this._cyclicBufferPos ? this._cyclicBufferPos - delta : this._cyclicBufferPos - delta + this._cyclicBufferSize) << 1;
          pby1 = this._bufferOffset + curMatch;
          len = len0 < len1 ? len0 : len1;
          if (this._bufferBase[pby1 + len] == this._bufferBase[cur + len]) {
            while ((len += 1) != lenLimit) {
              if (this._bufferBase[pby1 + len] != this._bufferBase[cur + len]) {
                break;
              }
            }
            if (len == lenLimit) {
              this._son[ptr1] = this._son[cyclicPos];
              this._son[ptr0] = this._son[cyclicPos + 1];
              break;
            }
          }
          if (this._bufferBase[pby1 + len] < this._bufferBase[cur + len]) {
            this._son[ptr1] = curMatch;
            ptr1 = cyclicPos + 1;
            curMatch = this._son[ptr1];
            len1 = len;
          } else {
            this._son[ptr0] = curMatch;
            ptr0 = cyclicPos;
            curMatch = this._son[ptr0];
            len0 = len;
          }
        }
        this.movePos();
      } while ((num -= 1) != 0);
    }
    movePos() {
      if ((this._cyclicBufferPos += 1) >= this._cyclicBufferSize) {
        this._cyclicBufferPos = 0;
      }
      this.movePosInWindow();
      if (this._pos == DICTIONARY_SIZE_THRESHOLD) {
        const subValue = this._pos - this._cyclicBufferSize;
        this.normalizeLinks(this._son, this._cyclicBufferSize * 2, subValue);
        this.normalizeLinks(this._hash, this._hashSizeSum, subValue);
        this.reduceOffsets(subValue);
      }
    }
    init() {
      this._bufferOffset = 0;
      this._pos = 0;
      this._streamPos = 0;
      this._streamEndWasReached = 0;
      this.readBlock();
      this._cyclicBufferPos = 0;
      this.reduceOffsets(-1);
    }
    /**
     * This is only called after reading one whole gigabyte.
     */
    normalizeLinks(items, numItems, subValue) {
      for (let i = 0; i < numItems; ++i) {
        let value = items[i];
        if (value <= subValue) {
          value = 0;
        } else {
          value -= subValue;
        }
        items[i] = value;
      }
    }
    setType(numHashBytes) {
      this.HASH_ARRAY = numHashBytes > 2;
      if (this.HASH_ARRAY) {
        this.kNumHashDirectBytes = 0;
        this.kMinMatchCheck = 4;
        this.kFixHashSize = 66560;
      } else {
        this.kNumHashDirectBytes = 2;
        this.kMinMatchCheck = 3;
        this.kFixHashSize = 0;
      }
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/encoder.js
  var bitTreePriceCache = /* @__PURE__ */ new Map();
  function getDirectBitsPrice(numBits) {
    return numBits << 6;
  }
  function getBitTreePrice(bitTree, symbol) {
    const cacheKey = bitTree.numBitLevels << 16 | symbol;
    if (bitTreePriceCache.has(cacheKey)) {
      return bitTreePriceCache.get(cacheKey);
    }
    let price = 0;
    let modelIndex = 1;
    for (let bitIndex = bitTree.numBitLevels; bitIndex > 0; bitIndex--) {
      const bit = symbol >>> bitIndex - 1 & 1;
      price += getBitPrice(bitTree.models[modelIndex], bit);
      modelIndex = (modelIndex << 1) + bit;
    }
    if (bitTreePriceCache.size < 1e4) {
      bitTreePriceCache.set(cacheKey, price);
    }
    return price;
  }
  var EncoderState = class {
    // Core state
    state = 0;
    previousByte = 0;
    position = 0n;
    // Repetition distances (LZ77 back-references)
    repDistances = [0, 0, 0, 0];
    // Match finding state
    longestMatchLength = 0;
    longestMatchWasFound = false;
    additionalOffset = 0;
    // Probability models for different encoding decisions
    isMatch = initArray(192);
    isRep = initArray(12);
    isRepG0 = initArray(12);
    isRepG1 = initArray(12);
    isRepG2 = initArray(12);
    isRep0Long = initArray(192);
    /**
     * Initialize all probability models to default values
     */
    initModels() {
      initBitModels(this.isMatch);
      initBitModels(this.isRep);
      initBitModels(this.isRepG0);
      initBitModels(this.isRepG1);
      initBitModels(this.isRepG2);
      initBitModels(this.isRep0Long);
    }
    /**
     * Update repetition distances when a new match is found
     */
    updateRepDistances(newDistance, repIndex) {
      if (repIndex === 0) {
        this.repDistances[3] = this.repDistances[2];
        this.repDistances[2] = this.repDistances[1];
        this.repDistances[1] = this.repDistances[0];
        this.repDistances[0] = newDistance;
      } else {
        const temp = this.repDistances[repIndex];
        for (let i = repIndex; i > 0; i--) {
          this.repDistances[i] = this.repDistances[i - 1];
        }
        this.repDistances[0] = temp;
      }
    }
  };
  var PositionEncoder = class {
    posSlotEncoder = [];
    posEncoders = initArray(114);
    posAlignEncoder;
    constructor() {
      for (let lenState = 0; lenState < 4; lenState++) {
        this.posSlotEncoder[lenState] = createBitTree(6);
      }
      this.posAlignEncoder = createBitTree(4);
    }
    /**
     * Initialize all position models
     */
    init() {
      for (const encoder of this.posSlotEncoder) {
        initBitModels(encoder.models);
      }
      initBitModels(this.posEncoders);
      initBitModels(this.posAlignEncoder.models);
    }
    /**
     * Encode position using optimal method
     */
    encodePosition(distance, lenState, rangeEncoder) {
      const posSlot = this.getPosSlot(distance);
      rangeEncoder.encodeBitTree(this.posSlotEncoder[lenState], posSlot);
      if (posSlot >= 4) {
        const footerBits = (posSlot >> 1) - 1;
        const baseVal = (2 | posSlot & 1) << footerBits;
        const posReduced = distance - baseVal;
        if (posSlot < 14) {
          this.encodeReverseBits(posReduced, footerBits, rangeEncoder);
        } else {
          rangeEncoder.encodeDirectBits(posReduced >> 4, footerBits - 4);
          rangeEncoder.encodeBitTree(this.posAlignEncoder, posReduced & 15);
        }
      }
    }
    /**
     * Calculate price for encoding a position
     */
    getPositionPrice(distance, lenState) {
      const posSlot = this.getPosSlot(distance);
      let price = getBitTreePrice(this.posSlotEncoder[lenState], posSlot);
      if (posSlot >= 4) {
        const footerBits = (posSlot >> 1) - 1;
        const baseVal = (2 | posSlot & 1) << footerBits;
        const posReduced = distance - baseVal;
        if (posSlot < 14) {
          price += this.getReverseBitsPrice(posReduced, footerBits);
        } else {
          price += getDirectBitsPrice(footerBits - 4);
          price += getBitTreePrice(this.posAlignEncoder, posReduced & 15);
        }
      }
      return price;
    }
    getPosSlot(distance) {
      if (distance < 4)
        return distance;
      if (distance < 1 << 31 - 11) {
        return G_FAST_POS[distance >> 6] + 12;
      }
      return G_FAST_POS[distance >> 26] + 52;
    }
    encodeReverseBits(value, numBits, rangeEncoder) {
      let modelIndex = 1;
      for (let i = 0; i < numBits; i++) {
        const bit = value & 1;
        rangeEncoder.encodeBit(this.posEncoders, modelIndex, bit);
        modelIndex = modelIndex << 1 | bit;
        value >>>= 1;
      }
    }
    getReverseBitsPrice(value, numBits) {
      let price = 0;
      let modelIndex = 1;
      for (let i = 0; i < numBits; i++) {
        const bit = value & 1;
        price += getBitPrice(this.posEncoders[modelIndex], bit);
        modelIndex = modelIndex << 1 | bit;
        value >>>= 1;
      }
      return price;
    }
  };
  var Encoder = class {
    encoderState = new EncoderState();
    positionEncoder = new PositionEncoder();
    // Core state properties
    _state = 0;
    _previousByte = 0;
    _distTableSize = 0;
    _longestMatchWasFound = 0;
    _optimumEndIndex = 0;
    _optimumCurrentIndex = 0;
    _additionalOffset = 0;
    // Dictionary and match finding
    _dictionarySize = 0;
    _matchFinder = null;
    _dictionarySizePrev = 0;
    _numFastBytes = 0;
    // Literal encoding configuration
    _numLiteralContextBits = 0;
    _numLiteralPosStateBits = 0;
    _posStateBits = 0;
    _posStateMask = 0;
    // Stream and processing state
    _needReleaseMFStream = 0;
    _inStream = null;
    _finished = 0;
    nowPos64 = 0n;
    // Distance and repetition arrays
    _repDistances = initArray(4);
    _optimum = [];
    // Range encoder
    _rangeEncoder = {
      stream: null,
      rrange: 0,
      cache: 0,
      low: 0n,
      cacheSize: 0,
      position: 0n,
      encodeBit: () => {
      },
      encodeBitTree: () => {
      },
      encodeDirectBits: () => {
      }
    };
    // Bit model arrays for different types of encoding decisions
    _isMatch = initArray(192);
    _isRep = initArray(12);
    _isRepG0 = initArray(12);
    _isRepG1 = initArray(12);
    _isRepG2 = initArray(12);
    _isRep0Long = initArray(192);
    // Position and alignment encoders
    _posSlotEncoder = [];
    _posEncoders = initArray(114);
    _posAlignEncoder = null;
    // Length encoders
    _lenEncoder = null;
    _repMatchLenEncoder = null;
    // Literal encoder
    _literalEncoder = null;
    // Distance and price arrays
    _matchDistances = [];
    _posSlotPrices = [];
    _distancesPrices = [];
    _alignPrices = initArray(16);
    _matchPriceCount = 0;
    _alignPriceCount = 0;
    // Optimization arrays
    reps = initArray(4);
    repLens = initArray(4);
    // Processing counters
    processedInSize = [0n];
    processedOutSize = [0n];
    finished = [0];
    properties = new Uint8Array(5);
    tempPrices = initArray(128);
    // 128
    // Match finding properties
    _longestMatchLength = 0;
    _matchFinderType = 1;
    _numDistancePairs = 0;
    _numFastBytesPrev = -1;
    backRes = 0;
    constructor() {
    }
    /**
     * Initialize basic encoder state
     */
    baseInit() {
      this._state = 0;
      this._previousByte = 0;
      for (let i = 0; i < 4; ++i) {
        this._repDistances[i] = 0;
      }
    }
    /**
     * Get optimum array
     */
    getOptimum() {
      return this._optimum;
    }
    /**
     * Get back result
     */
    getBackRes() {
      return this.backRes;
    }
    setBackRes(backRes) {
      this.backRes = backRes;
    }
    init() {
      this.baseInit();
      this.encoderState.initModels();
      this.positionEncoder.init();
      this._optimum = [];
      for (let i = 0; i < 4096; i++) {
        this._optimum[i] = {};
      }
      this.initEncoderState();
      initBitModels(this._isMatch);
      initBitModels(this._isRep0Long);
      initBitModels(this._isRep);
      initBitModels(this._isRepG0);
      initBitModels(this._isRepG1);
      initBitModels(this._isRepG2);
      initBitModels(this._posEncoders);
      this.initLiteralEncoder();
      for (let i = 0; i < 4; ++i) {
        initBitModels(this._posSlotEncoder[i].models);
      }
      if (this._lenEncoder) {
        this._lenEncoder.init(1 << this._posStateBits);
      }
      if (this._repMatchLenEncoder) {
        this._repMatchLenEncoder.init(1 << this._posStateBits);
      }
      if (this._posAlignEncoder) {
        initBitModels(this._posAlignEncoder.models);
      }
      this._longestMatchWasFound = 0;
      this._optimumEndIndex = 0;
      this._optimumCurrentIndex = 0;
      this._additionalOffset = 0;
    }
    /**
     * Initialize encoder range coder
     */
    initEncoderState() {
      this._rangeEncoder.low = 0n;
      this._rangeEncoder.rrange = 4294967295;
      this._rangeEncoder.cacheSize = 1;
      this._rangeEncoder.cache = 0;
      this._rangeEncoder.position = 0n;
    }
    /**
     * Initialize literal encoder
     */
    initLiteralEncoder() {
      const totalStates = 1 << this._literalEncoder.numPrevBits + this._literalEncoder.numPosBits;
      for (let i = 0; i < totalStates; ++i) {
        initBitModels(this._literalEncoder.coders[i].decoders);
      }
    }
    /**
     * Create optimum structures
     */
    createOptimumStructures() {
      for (let i = 0; i < 4096; ++i) {
        this._optimum[i] = {};
      }
      for (let i = 0; i < 4; ++i) {
        this._posSlotEncoder[i] = createBitTree(6);
      }
    }
    /**
     * Create length price table encoder
     */
    createLenPriceTableEncoder() {
      const encoder = new LenEncoder();
      encoder.initPriceTable();
      return encoder;
    }
    /**
     * Create literal encoder encoder2
     */
    createLiteralEncoderEncoder2() {
      const encoder = {
        decoders: initArray(768)
      };
      return encoder;
    }
    /**
     * Create literal encoder
     */
    createLiteralEncoder() {
      if (this._literalEncoder != null && this._literalEncoder.numPrevBits == this._numLiteralContextBits && this._literalEncoder.numPosBits == this._numLiteralPosStateBits) {
        return;
      }
      this._literalEncoder = new LitCoder(this._numLiteralPosStateBits, this._numLiteralContextBits);
    }
    /**
     * Initialize completely with proper encoder state
     */
    initialize() {
      this._lenEncoder = this.createLenPriceTableEncoder();
      this._repMatchLenEncoder = this.createLenPriceTableEncoder();
      this._posAlignEncoder = createBitTree(4);
      this._optimum = [];
      this.createOptimumStructures();
      this.createLiteralEncoder();
      this.init();
    }
    /**
     * Configure encoder settings
     */
    configure(mode) {
      this.setDictionarySize(1 << mode.searchDepth);
      this._numFastBytes = mode.filterStrength;
      this._matchFinderType = mode.modeIndex;
      this._numLiteralContextBits = 3;
      this._numLiteralPosStateBits = 0;
      this._posStateBits = 2;
      this._posStateMask = 3;
    }
    /**
     * Set dictionary size
     */
    setDictionarySize(dictionarySize) {
      this._dictionarySize = dictionarySize;
      let dicLogSize = 0;
      for (; dictionarySize > 1 << dicLogSize; ++dicLogSize)
        ;
      this._distTableSize = dicLogSize * 2;
    }
    /**
     * Encode a bit using range coder
     */
    encodeBit(probs, index, symbol) {
      const rangeEncoder = this._rangeEncoder;
      let newBound, prob = probs[index];
      newBound = (rangeEncoder.rrange >>> 11) * prob;
      if (!symbol) {
        rangeEncoder.rrange = newBound;
        probs[index] = prob + (2048 - prob >>> 5);
      } else {
        rangeEncoder.low += BigInt(newBound >>> 0);
        rangeEncoder.rrange -= newBound;
        probs[index] = prob - (prob >>> 5);
      }
      if (!(rangeEncoder.rrange & -16777216)) {
        rangeEncoder.rrange <<= 8;
        this.shiftLow();
      }
    }
    /**
     * Encode bit tree
     */
    encodeBitTree(encoder, symbol) {
      let bit, bitIndex, m = 1;
      for (bitIndex = encoder.numBitLevels; bitIndex != 0; ) {
        bitIndex -= 1;
        bit = symbol >>> bitIndex & 1;
        this.encodeBit(encoder.models, m, bit);
        m = m << 1 | bit;
      }
    }
    /**
     * Encode literal
     */
    encodeLiteral(encoder, symbol) {
      let bit, context = 1;
      for (let i = 7; i >= 0; --i) {
        bit = symbol >> i & 1;
        this.encodeBit(encoder.decoders, context, bit);
        context = context << 1 | bit;
      }
    }
    /**
     * Encode matched literal
     */
    encodeMatched(encoder, matchByte, symbol) {
      let bit, matchBit, state, same = true, context = 1;
      for (let i = 7; i >= 0; --i) {
        bit = symbol >> i & 1;
        state = context;
        if (same) {
          matchBit = matchByte >> i & 1;
          state += 1 + matchBit << 8;
          same = matchBit === bit;
        }
        this.encodeBit(encoder.decoders, state, bit);
        context = context << 1 | bit;
      }
    }
    /**
     * Encode length using direct method calls
     */
    encodeLength(encoder, symbol, posState) {
      encoder.encode(symbol, posState, this);
    }
    /**
     * Encode direct bits
     */
    encodeDirectBits(valueToEncode, numTotalBits) {
      const rangeEncoder = this._rangeEncoder;
      for (let i = numTotalBits - 1; i >= 0; i -= 1) {
        rangeEncoder.rrange >>>= 1;
        if ((valueToEncode >>> i & 1) == 1) {
          rangeEncoder.low += BigInt(rangeEncoder.rrange >>> 0);
        }
        if (!(rangeEncoder.rrange & -16777216)) {
          rangeEncoder.rrange <<= 8;
          this.shiftLow();
        }
      }
    }
    /**
     * Reverse encode
     */
    reverseEncode(symbol) {
      const posAlignEncoder = this._posAlignEncoder;
      if (!posAlignEncoder)
        return;
      let bit, m = 1;
      for (let i = 0; i < posAlignEncoder.numBitLevels; ++i) {
        bit = symbol & 1;
        this.encodeBit(posAlignEncoder.models, m, bit);
        m = m << 1 | bit;
        symbol >>= 1;
      }
    }
    /**
     * Reverse encode range
     */
    reverseEncodeRange(startIndex, numBitLevels, symbol) {
      let bit, m = 1;
      for (let i = 0; i < numBitLevels; ++i) {
        bit = symbol & 1;
        this.encodeBit(this._posEncoders, startIndex + m, bit);
        m = m << 1 | bit;
        symbol >>= 1;
      }
    }
    /**
     * Write end marker
     */
    writeEndMarker(positionState) {
      this.encodeBit(this._isMatch, (this._state << 4) + positionState, 1);
      this.encodeBit(this._isRep, this._state, 0);
      this._state = this._state < 7 ? 7 : 10;
      this.encodeLength(this._lenEncoder, 0, positionState);
      const posSlot = 63;
      const lenToPosState = getLenToPosState(2);
      this.encodeBitTree(this._posSlotEncoder[lenToPosState], posSlot);
      this.encodeDirectBits(67108863, 26);
      this.reverseEncode(15);
    }
    /**
     * Encode length with price table update
     */
    encodeLengthWithPriceUpdate(encoder, symbol, posState) {
      encoder.encodeWithUpdate(symbol, posState, this);
    }
    /**
     * Shift low helper (proper implementation) - public method for external access
     */
    shiftLow() {
      const rangeEncoder = this._rangeEncoder;
      const lowHi = Number(rangeEncoder.low >> 32n & 0xffffffffn);
      const lowLow = Number(rangeEncoder.low & 0xffffffffn);
      if (lowHi != 0 || lowLow < 4278190080) {
        rangeEncoder.position += BigInt(rangeEncoder.cacheSize);
        let temp = rangeEncoder.cache;
        do {
          this.writeToStream(rangeEncoder.stream, temp + lowHi);
          temp = 255;
        } while ((rangeEncoder.cacheSize -= 1) != 0);
        rangeEncoder.cache = lowLow >>> 24 & 255;
      }
      rangeEncoder.cacheSize += 1;
      rangeEncoder.low = BigInt(lowLow & 16777215) << 8n;
    }
    /**
     * Write byte to stream
     */
    writeToStream(stream, b) {
      if (!stream)
        return;
      stream.writeByte(b << 24 >> 24);
    }
    initRangeEncoder() {
      this._rangeEncoder.position = 0n;
      this._rangeEncoder.low = 0n;
      this._rangeEncoder.rrange = -1;
      this._rangeEncoder.cacheSize = 1;
      this._rangeEncoder.cache = 0;
    }
    /**
     * Fill alignment prices for position alignment encoder
     */
    fillAlignPrices() {
      for (let i = 0; i < 16; ++i) {
        this._alignPrices[i] = this.reverseGetPrice(this._posAlignEncoder, i);
      }
      this._alignPriceCount = 0;
    }
    /**
     * Fill distance prices for position encoders
     */
    fillDistancesPrices() {
      let baseVal, bitTreeEncoder, footerBits, posSlot, st, st2;
      for (let i = 4; i < 128; ++i) {
        posSlot = this.getPosSlot(i);
        footerBits = (posSlot >> 1) - 1;
        baseVal = (2 | posSlot & 1) << footerBits;
        this.tempPrices[i] = this.reverseGetPriceArray(this._posEncoders, baseVal - posSlot - 1, footerBits, i - baseVal);
      }
      for (let lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
        bitTreeEncoder = this._posSlotEncoder[lenToPosState];
        st = lenToPosState << 6;
        for (posSlot = 0; posSlot < this._distTableSize; posSlot += 1) {
          this._posSlotPrices[st + posSlot] = this.getEncoderBitTreePrice(bitTreeEncoder, posSlot);
        }
        for (posSlot = 14; posSlot < this._distTableSize; posSlot += 1) {
          this._posSlotPrices[st + posSlot] += (posSlot >> 1) - 1 - 4 << 6;
        }
        st2 = lenToPosState * 128;
        for (let i = 0; i < 4; ++i) {
          this._distancesPrices[st2 + i] = this._posSlotPrices[st + i];
        }
        for (let i = 4; i < 128; ++i) {
          this._distancesPrices[st2 + i] = this._posSlotPrices[st + this.getPosSlot(i)] + this.tempPrices[i];
        }
      }
      this._matchPriceCount = 0;
    }
    /**
     * Get position slot for a distance value
     */
    getPosSlot(pos) {
      if (pos < 2048) {
        return G_FAST_POS[pos];
      }
      if (pos < 2097152) {
        return G_FAST_POS[pos >> 10] + 20;
      }
      return G_FAST_POS[pos >> 20] + 40;
    }
    /**
     * Get reverse price for bit tree encoder
     */
    reverseGetPrice(encoder, symbol) {
      let bit, m = 1, price = 0;
      for (let i = encoder.numBitLevels; i != 0; i -= 1) {
        bit = symbol & 1;
        symbol >>>= 1;
        price += this.getPrice(encoder.models[m], bit);
        m = m << 1 | bit;
      }
      return price;
    }
    /**
     * Get reverse price for array of models
     */
    reverseGetPriceArray(models, startIndex, numBitLevels, symbol) {
      let bit, m = 1, price = 0;
      for (let i = numBitLevels; i != 0; i -= 1) {
        bit = symbol & 1;
        symbol >>>= 1;
        price += PROB_PRICES[((models[startIndex + m] - bit ^ -bit) & 2047) >>> 2];
        m = m << 1 | bit;
      }
      return price;
    }
    /**
     * Get price for probability model (optimized)
     */
    getPrice(prob, symbol) {
      return getBitPrice(prob, symbol);
    }
    /**
     * Get price for bit tree encoder
     */
    getEncoderBitTreePrice(encoder, symbol) {
      return getBitTreePrice(encoder, symbol);
    }
    /**
     * Create encoder optimization structures (optimized)
     */
    createEncoderStructures() {
      this._optimum = [];
      for (let i = 0; i < 4096; i++) {
        this._optimum[i] = {};
      }
      for (let i = 0; i < 4096; ++i) {
        this._optimum[i] = {};
      }
      this._posSlotEncoder = new Array(4);
      for (let i = 0; i < 4; ++i) {
        this._posSlotEncoder[i] = createBitTree(6);
      }
    }
    /**
     * Get literal encoder subcoder (utility method)
     */
    getSubCoderUtility(pos, prevByte) {
      const posBits = pos & this._literalEncoder.posMask;
      const posShifted = posBits << this._literalEncoder.numPrevBits;
      const prevByteShift = 8 - this._literalEncoder.numPrevBits;
      const prevByteBits = (prevByte & 255) >>> prevByteShift;
      const coderIndex = posShifted + prevByteBits;
      return this._literalEncoder.coders[coderIndex];
    }
    // ── Encoding orchestration methods (moved from LZMA) ──
    makeAsChar(optimum) {
      optimum.backPrev = -1;
      optimum.prev1IsChar = 0;
    }
    makeAsShortRep(optimum) {
      optimum.backPrev = 0;
      optimum.prev1IsChar = 0;
    }
    releaseMFStream() {
      if (this._matchFinder && this._needReleaseMFStream) {
        this._matchFinder._stream = null;
        this._needReleaseMFStream = 0;
      }
    }
    releaseStreams() {
      this.releaseMFStream();
      this._rangeEncoder.stream = null;
    }
    getProcessedSizeAdd() {
      return BigInt(this._rangeEncoder.cacheSize) + this._rangeEncoder.position + 4n;
    }
    getSubCoder(pos, prevByte) {
      const subCoder = this._literalEncoder.getSubCoder(pos, prevByte);
      return { decoders: subCoder.decoders };
    }
    getLiteralPrice(encoder, matchMode, matchByte, symbol) {
      let bit, context = 1, i = 7, matchBit, price = 0;
      if (matchMode) {
        for (; i >= 0; --i) {
          matchBit = matchByte >> i & 1;
          bit = symbol >> i & 1;
          price += getBitPrice(encoder.decoders[(1 + matchBit << 8) + context], bit);
          context = context << 1 | bit;
          if (matchBit != bit) {
            --i;
            break;
          }
        }
      }
      for (; i >= 0; --i) {
        bit = symbol >> i & 1;
        price += getBitPrice(encoder.decoders[context], bit);
        context = context << 1 | bit;
      }
      return price;
    }
    getPosLenPrice(pos, len, posState) {
      let price, lenToPosState = getLenToPosState(len);
      if (pos < 128) {
        price = this._distancesPrices[lenToPosState * 128 + pos];
      } else {
        const position = (lenToPosState << 6) + this.getPosSlot2(pos);
        price = this._posSlotPrices[position] + this._alignPrices[pos & 15];
      }
      return price + this._lenEncoder.getPrice(len - 2, posState);
    }
    getPureRepPrice(repIndex, state, posState) {
      let price;
      if (!repIndex) {
        price = PROB_PRICES[this._isRepG0[state] >>> 2];
        price += PROB_PRICES[2048 - this._isRep0Long[(state << 4) + posState] >>> 2];
      } else {
        price = PROB_PRICES[2048 - this._isRepG0[state] >>> 2];
        if (repIndex == 1) {
          price += PROB_PRICES[this._isRepG1[state] >>> 2];
        } else {
          price += PROB_PRICES[2048 - this._isRepG1[state] >>> 2];
          price += getBitPrice(this._isRepG2[state], repIndex - 2);
        }
      }
      return price;
    }
    getRepLen1Price(posState) {
      const repG0Price = PROB_PRICES[this._isRepG0[this._state] >>> 2];
      const rep0LongPrice = PROB_PRICES[this._isRep0Long[(this._state << 4) + posState] >>> 2];
      return repG0Price + rep0LongPrice;
    }
    getPosSlot2(pos) {
      if (pos < 131072) {
        return G_FAST_POS[pos >> 6] + 12;
      }
      if (pos < 134217728) {
        return G_FAST_POS[pos >> 16] + 32;
      }
      return G_FAST_POS[pos >> 26] + 52;
    }
    movePosHelper(num) {
      if (num > 0) {
        this._matchFinder.skip(num);
        this._additionalOffset += num;
      }
    }
    readMatchDistances() {
      let lenRes = 0;
      this._numDistancePairs = this._matchFinder.getMatches(this._matchDistances);
      if (this._numDistancePairs > 0) {
        lenRes = this._matchDistances[this._numDistancePairs - 2];
        if (lenRes == this._numFastBytes) {
          lenRes += this._matchFinder.getMatchLen(lenRes - 1, this._matchDistances[this._numDistancePairs - 1], 273 - lenRes);
        }
      }
      this._additionalOffset += 1;
      return lenRes;
    }
    flushEncoding(nowPos) {
      this.releaseMFStream();
      this.writeEndMarker(nowPos & this._posStateMask);
      for (let i = 0; i < 5; ++i) {
        this.shiftLow();
      }
    }
    backward(cur) {
      let backCur, backMem, posMem, posPrev;
      this._optimumEndIndex = cur;
      posMem = this._optimum[cur].posPrev;
      backMem = this._optimum[cur].backPrev;
      do {
        if (this._optimum[cur].prev1IsChar) {
          this.makeAsChar(this._optimum[posMem]);
          this._optimum[posMem].posPrev = posMem - 1;
          if (this._optimum[cur].prev2) {
            this._optimum[posMem - 1].prev1IsChar = 0;
            this._optimum[posMem - 1].posPrev = this._optimum[cur].posPrev2;
            this._optimum[posMem - 1].backPrev = this._optimum[cur].backPrev2;
          }
        }
        posPrev = posMem;
        backCur = backMem;
        backMem = this._optimum[posPrev].backPrev;
        posMem = this._optimum[posPrev].posPrev;
        this._optimum[posPrev].backPrev = backCur;
        this._optimum[posPrev].posPrev = cur;
        cur = posPrev;
      } while (cur > 0);
      this.backRes = this._optimum[0].backPrev;
      this._optimumCurrentIndex = this._optimum[0].posPrev;
      return this._optimumCurrentIndex;
    }
    getOptimumLength(position) {
      let cur, curAnd1Price, curAndLenCharPrice, curAndLenPrice, curBack, curPrice, currentByte, distance, len, lenEnd, lenMain, lenTest, lenTest2, lenTestTemp, matchByte, matchPrice, newLen, nextIsChar, nextMatchPrice, nextOptimum, nextRepMatchPrice, normalMatchPrice, numAvailableBytes, numAvailableBytesFull, numDistancePairs, offs, offset, opt, optimum, pos, posPrev, posState, posStateNext, price_4, repIndex, repLen, repMatchPrice, repMaxIndex, shortRepPrice, startLen, state, state2, t, price, price_0, price_1, price_2, price_3, lenRes;
      if (this._optimumEndIndex != this._optimumCurrentIndex) {
        lenRes = this._optimum[this._optimumCurrentIndex].posPrev - this._optimumCurrentIndex;
        this.backRes = this._optimum[this._optimumCurrentIndex].backPrev;
        this._optimumCurrentIndex = this._optimum[this._optimumCurrentIndex].posPrev;
        return lenRes;
      }
      this._optimumCurrentIndex = this._optimumEndIndex = 0;
      if (this._longestMatchWasFound) {
        lenMain = this._longestMatchLength;
        this._longestMatchWasFound = 0;
      } else {
        lenMain = this.readMatchDistances();
      }
      numDistancePairs = this._numDistancePairs;
      numAvailableBytes = this._matchFinder.getNumAvailableBytes() + 1;
      if (numAvailableBytes < 2) {
        this.backRes = -1;
        return 1;
      }
      if (numAvailableBytes > 273) {
        numAvailableBytes = 273;
      }
      repMaxIndex = 0;
      for (let i = 0; i < 4; ++i) {
        this.reps[i] = this._repDistances[i];
        this.repLens[i] = this._matchFinder.getMatchLen(-1, this.reps[i], 273);
        if (this.repLens[i] > this.repLens[repMaxIndex]) {
          repMaxIndex = i;
        }
      }
      if (this.repLens[repMaxIndex] >= this._numFastBytes) {
        this.backRes = repMaxIndex;
        lenRes = this.repLens[repMaxIndex];
        this.movePosHelper(lenRes - 1);
        return lenRes;
      }
      if (lenMain >= this._numFastBytes) {
        this.backRes = this._matchDistances[numDistancePairs - 1] + 4;
        this.movePosHelper(lenMain - 1);
        return lenMain;
      }
      currentByte = this._matchFinder.getIndexByte(-1);
      matchByte = this._matchFinder.getIndexByte(-this._repDistances[0] - 1 - 1);
      if (lenMain < 2 && currentByte != matchByte && this.repLens[repMaxIndex] < 2) {
        this.backRes = -1;
        return 1;
      }
      this._optimum[0].state = this._state;
      posState = position & this._posStateMask;
      this._optimum[1].price = PROB_PRICES[this._isMatch[(this._state << 4) + posState] >>> 2] + this.getLiteralPrice(this.getSubCoder(position, this._previousByte), this._state >= 7, matchByte, currentByte);
      this.makeAsChar(this._optimum[1]);
      matchPrice = PROB_PRICES[2048 - this._isMatch[(this._state << 4) + posState] >>> 2];
      repMatchPrice = matchPrice + PROB_PRICES[2048 - this._isRep[this._state] >>> 2];
      if (matchByte == currentByte) {
        shortRepPrice = repMatchPrice + this.getRepLen1Price(posState);
        if (shortRepPrice < this._optimum[1].price) {
          this._optimum[1].price = shortRepPrice;
          this.makeAsShortRep(this._optimum[1]);
        }
      }
      lenEnd = lenMain >= this.repLens[repMaxIndex] ? lenMain : this.repLens[repMaxIndex];
      if (lenEnd < 2) {
        this.backRes = this._optimum[1].backPrev;
        return 1;
      }
      this._optimum[1].posPrev = 0;
      this._optimum[0].backs0 = this.reps[0];
      this._optimum[0].backs1 = this.reps[1];
      this._optimum[0].backs2 = this.reps[2];
      this._optimum[0].backs3 = this.reps[3];
      len = lenEnd;
      do {
        this._optimum[len].price = INFINITY_PRICE;
        len -= 1;
      } while (len >= 2);
      for (let i = 0; i < 4; ++i) {
        repLen = this.repLens[i];
        if (repLen < 2) {
          continue;
        }
        price_4 = repMatchPrice + this.getPureRepPrice(i, this._state, posState);
        do {
          curAndLenPrice = price_4 + this._repMatchLenEncoder.getPrice(repLen - 2, posState);
          optimum = this._optimum[repLen];
          if (curAndLenPrice < optimum.price) {
            optimum.price = curAndLenPrice;
            optimum.posPrev = 0;
            optimum.backPrev = i;
            optimum.prev1IsChar = 0;
          }
        } while ((repLen -= 1) >= 2);
      }
      normalMatchPrice = matchPrice + PROB_PRICES[this._isRep[this._state] >>> 2];
      len = this.repLens[0] >= 2 ? this.repLens[0] + 1 : 2;
      if (len <= lenMain) {
        offs = 0;
        while (len > this._matchDistances[offs]) {
          offs += 2;
        }
        for (; ; len += 1) {
          distance = this._matchDistances[offs + 1];
          curAndLenPrice = normalMatchPrice + this.getPosLenPrice(distance, len, posState);
          optimum = this._optimum[len];
          if (curAndLenPrice < optimum.price) {
            optimum.price = curAndLenPrice;
            optimum.posPrev = 0;
            optimum.backPrev = distance + 4;
            optimum.prev1IsChar = 0;
          }
          if (len == this._matchDistances[offs]) {
            offs += 2;
            if (offs == numDistancePairs) {
              break;
            }
          }
        }
      }
      cur = 0;
      while (1) {
        ++cur;
        if (cur == lenEnd) {
          return this.backward(cur);
        }
        newLen = this.readMatchDistances();
        numDistancePairs = this._numDistancePairs;
        if (newLen >= this._numFastBytes) {
          this._longestMatchLength = newLen;
          this._longestMatchWasFound = 1;
          return this.backward(cur);
        }
        position += 1;
        posPrev = this._optimum[cur].posPrev;
        if (this._optimum[cur].prev1IsChar) {
          posPrev -= 1;
          if (this._optimum[cur].prev2) {
            state = this._optimum[this._optimum[cur].posPrev2].state;
            if (this._optimum[cur].backPrev2 < 4) {
              state = state < 7 ? 8 : 11;
            } else {
              state = state < 7 ? 7 : 10;
            }
          } else {
            state = this._optimum[posPrev].state;
          }
          state = stateUpdateChar(state);
        } else {
          state = this._optimum[posPrev].state;
        }
        if (posPrev == cur - 1) {
          if (!this._optimum[cur].backPrev) {
            state = state < 7 ? 9 : 11;
          } else {
            state = stateUpdateChar(state);
          }
        } else {
          if (this._optimum[cur].prev1IsChar && this._optimum[cur].prev2) {
            posPrev = this._optimum[cur].posPrev2;
            pos = this._optimum[cur].backPrev2;
            state = state < 7 ? 8 : 11;
          } else {
            pos = this._optimum[cur].backPrev;
            if (pos < 4) {
              state = state < 7 ? 8 : 11;
            } else {
              state = state < 7 ? 7 : 10;
            }
          }
          opt = this._optimum[posPrev];
          if (pos < 4) {
            if (!pos) {
              this.reps[0] = opt.backs0;
              this.reps[1] = opt.backs1;
              this.reps[2] = opt.backs2;
              this.reps[3] = opt.backs3;
            } else if (pos == 1) {
              this.reps[0] = opt.backs1;
              this.reps[1] = opt.backs0;
              this.reps[2] = opt.backs2;
              this.reps[3] = opt.backs3;
            } else if (pos == 2) {
              this.reps[0] = opt.backs2;
              this.reps[1] = opt.backs0;
              this.reps[2] = opt.backs1;
              this.reps[3] = opt.backs3;
            } else {
              this.reps[0] = opt.backs3;
              this.reps[1] = opt.backs0;
              this.reps[2] = opt.backs1;
              this.reps[3] = opt.backs2;
            }
          } else {
            this.reps[0] = pos - 4;
            this.reps[1] = opt.backs0;
            this.reps[2] = opt.backs1;
            this.reps[3] = opt.backs2;
          }
        }
        this._optimum[cur].state = state;
        this._optimum[cur].backs0 = this.reps[0];
        this._optimum[cur].backs1 = this.reps[1];
        this._optimum[cur].backs2 = this.reps[2];
        this._optimum[cur].backs3 = this.reps[3];
        curPrice = this._optimum[cur].price;
        currentByte = this._matchFinder.getIndexByte(-1);
        matchByte = this._matchFinder.getIndexByte(-this.reps[0] - 1 - 1);
        posState = position & this._posStateMask;
        curAnd1Price = curPrice + PROB_PRICES[this._isMatch[(state << 4) + posState] >>> 2] + this.getLiteralPrice(this.getSubCoder(position, this._matchFinder.getIndexByte(-2)), state >= 7, matchByte, currentByte);
        nextOptimum = this._optimum[cur + 1];
        nextIsChar = 0;
        if (curAnd1Price < nextOptimum.price) {
          nextOptimum.price = curAnd1Price;
          nextOptimum.posPrev = cur;
          nextOptimum.backPrev = -1;
          nextOptimum.prev1IsChar = 0;
          nextIsChar = 1;
        }
        matchPrice = curPrice + PROB_PRICES[2048 - this._isMatch[(state << 4) + posState] >>> 2];
        repMatchPrice = matchPrice + PROB_PRICES[2048 - this._isRep[state] >>> 2];
        if (matchByte == currentByte && !(nextOptimum.posPrev < cur && !nextOptimum.backPrev)) {
          shortRepPrice = repMatchPrice + (PROB_PRICES[this._isRepG0[state] >>> 2] + PROB_PRICES[this._isRep0Long[(state << 4) + posState] >>> 2]);
          if (shortRepPrice <= nextOptimum.price) {
            nextOptimum.price = shortRepPrice;
            nextOptimum.posPrev = cur;
            nextOptimum.backPrev = 0;
            nextOptimum.prev1IsChar = 0;
            nextIsChar = 1;
          }
        }
        numAvailableBytesFull = this._matchFinder.getNumAvailableBytes() + 1;
        numAvailableBytesFull = 4095 - cur < numAvailableBytesFull ? 4095 - cur : numAvailableBytesFull;
        numAvailableBytes = numAvailableBytesFull;
        if (numAvailableBytes < 2) {
          continue;
        }
        if (numAvailableBytes > this._numFastBytes) {
          numAvailableBytes = this._numFastBytes;
        }
        if (!nextIsChar && matchByte != currentByte) {
          t = Math.min(numAvailableBytesFull - 1, this._numFastBytes);
          lenTest2 = this._matchFinder.getMatchLen(0, this.reps[0], t);
          if (lenTest2 >= 2) {
            state2 = stateUpdateChar(state);
            posStateNext = position + 1 & this._posStateMask;
            nextRepMatchPrice = curAnd1Price + PROB_PRICES[2048 - this._isMatch[(state2 << 4) + posStateNext] >>> 2] + PROB_PRICES[2048 - this._isRep[state2] >>> 2];
            offset = cur + 1 + lenTest2;
            while (lenEnd < offset) {
              this._optimum[lenEnd += 1].price = INFINITY_PRICE;
            }
            curAndLenPrice = nextRepMatchPrice + (price = this._repMatchLenEncoder.getPrice(lenTest2 - 2, posStateNext), price + this.getPureRepPrice(0, state2, posStateNext));
            optimum = this._optimum[offset];
            if (curAndLenPrice < optimum.price) {
              optimum.price = curAndLenPrice;
              optimum.posPrev = cur + 1;
              optimum.backPrev = 0;
              optimum.prev1IsChar = 1;
              optimum.prev2 = 0;
            }
          }
        }
        startLen = 2;
        for (repIndex = 0; repIndex < 4; ++repIndex) {
          lenTest = this._matchFinder.getMatchLen(-1, this.reps[repIndex], numAvailableBytes);
          if (lenTest < 2) {
            continue;
          }
          lenTestTemp = lenTest;
          do {
            while (lenEnd < cur + lenTest) {
              this._optimum[lenEnd += 1].price = INFINITY_PRICE;
            }
            curAndLenPrice = repMatchPrice + (price_0 = this._repMatchLenEncoder.getPrice(lenTest - 2, posState), price_0 + this.getPureRepPrice(repIndex, state, posState));
            optimum = this._optimum[cur + lenTest];
            if (curAndLenPrice < optimum.price) {
              optimum.price = curAndLenPrice;
              optimum.posPrev = cur;
              optimum.backPrev = repIndex;
              optimum.prev1IsChar = 0;
            }
          } while ((lenTest -= 1) >= 2);
          lenTest = lenTestTemp;
          if (!repIndex) {
            startLen = lenTest + 1;
          }
          if (lenTest < numAvailableBytesFull) {
            t = Math.min(numAvailableBytesFull - 1 - lenTest, this._numFastBytes);
            lenTest2 = this._matchFinder.getMatchLen(lenTest, this.reps[repIndex], t);
            if (lenTest2 >= 2) {
              state2 = state < 7 ? 8 : 11;
              posStateNext = position + lenTest & this._posStateMask;
              curAndLenCharPrice = repMatchPrice + (price_1 = this._repMatchLenEncoder.getPrice(lenTest - 2, posState), price_1 + this.getPureRepPrice(repIndex, state, posState)) + PROB_PRICES[this._isMatch[(state2 << 4) + posStateNext] >>> 2] + this.getLiteralPrice(this.getSubCoder(position + lenTest, this._matchFinder.getIndexByte(lenTest - 1 - 1)), true, this._matchFinder.getIndexByte(lenTest - 1 - (this.reps[repIndex] + 1)), this._matchFinder.getIndexByte(lenTest - 1));
              state2 = stateUpdateChar(state2);
              posStateNext = position + lenTest + 1 & this._posStateMask;
              nextMatchPrice = curAndLenCharPrice + PROB_PRICES[2048 - this._isMatch[(state2 << 4) + posStateNext] >>> 2];
              nextRepMatchPrice = nextMatchPrice + PROB_PRICES[2048 - this._isRep[state2] >>> 2];
              offset = lenTest + 1 + lenTest2;
              while (lenEnd < cur + offset) {
                this._optimum[lenEnd += 1].price = INFINITY_PRICE;
              }
              curAndLenPrice = nextRepMatchPrice + (price_2 = this._repMatchLenEncoder.getPrice(lenTest2 - 2, posStateNext), price_2 + this.getPureRepPrice(0, state2, posStateNext));
              optimum = this._optimum[cur + offset];
              if (curAndLenPrice < optimum.price) {
                optimum.price = curAndLenPrice;
                optimum.posPrev = cur + lenTest + 1;
                optimum.backPrev = 0;
                optimum.prev1IsChar = 1;
                optimum.prev2 = 1;
                optimum.posPrev2 = cur;
                optimum.backPrev2 = repIndex;
              }
            }
          }
        }
        if (newLen > numAvailableBytes) {
          newLen = numAvailableBytes;
          for (numDistancePairs = 0; newLen > this._matchDistances[numDistancePairs]; numDistancePairs += 2) {
          }
          this._matchDistances[numDistancePairs] = newLen;
          numDistancePairs += 2;
        }
        if (newLen >= startLen) {
          normalMatchPrice = matchPrice + PROB_PRICES[this._isRep[state] >>> 2];
          while (lenEnd < cur + newLen) {
            this._optimum[lenEnd += 1].price = INFINITY_PRICE;
          }
          offs = 0;
          while (startLen > this._matchDistances[offs]) {
            offs += 2;
          }
          for (lenTest = startLen; ; lenTest += 1) {
            curBack = this._matchDistances[offs + 1];
            curAndLenPrice = normalMatchPrice + this.getPosLenPrice(curBack, lenTest, posState);
            optimum = this._optimum[cur + lenTest];
            if (curAndLenPrice < optimum.price) {
              optimum.price = curAndLenPrice;
              optimum.posPrev = cur;
              optimum.backPrev = curBack + 4;
              optimum.prev1IsChar = 0;
            }
            if (lenTest == this._matchDistances[offs]) {
              if (lenTest < numAvailableBytesFull) {
                t = Math.min(numAvailableBytesFull - 1 - lenTest, this._numFastBytes);
                lenTest2 = this._matchFinder.getMatchLen(lenTest, curBack, t);
                if (lenTest2 >= 2) {
                  state2 = state < 7 ? 7 : 10;
                  posStateNext = position + lenTest & this._posStateMask;
                  curAndLenCharPrice = curAndLenPrice + PROB_PRICES[this._isMatch[(state2 << 4) + posStateNext] >>> 2] + this.getLiteralPrice(this.getSubCoder(position + lenTest, this._matchFinder.getIndexByte(lenTest - 1 - 1)), true, this._matchFinder.getIndexByte(lenTest - (curBack + 1) - 1), this._matchFinder.getIndexByte(lenTest - 1));
                  state2 = stateUpdateChar(state2);
                  posStateNext = position + lenTest + 1 & this._posStateMask;
                  nextMatchPrice = curAndLenCharPrice + PROB_PRICES[2048 - this._isMatch[(state2 << 4) + posStateNext] >>> 2];
                  nextRepMatchPrice = nextMatchPrice + PROB_PRICES[2048 - this._isRep[state2] >>> 2];
                  offset = lenTest + 1 + lenTest2;
                  while (lenEnd < cur + offset) {
                    this._optimum[lenEnd += 1].price = INFINITY_PRICE;
                  }
                  curAndLenPrice = nextRepMatchPrice + (price_3 = this._repMatchLenEncoder.getPrice(lenTest2 - 2, posStateNext), price_3 + this.getPureRepPrice(0, state2, posStateNext));
                  optimum = this._optimum[cur + offset];
                  if (curAndLenPrice < optimum.price) {
                    optimum.price = curAndLenPrice;
                    optimum.posPrev = cur + lenTest + 1;
                    optimum.backPrev = 0;
                    optimum.prev1IsChar = 1;
                    optimum.prev2 = 1;
                    optimum.posPrev2 = cur;
                    optimum.backPrev2 = curBack + 4;
                  }
                }
              }
              offs += 2;
              if (offs == numDistancePairs) {
                break;
              }
            }
          }
        }
      }
      return 1;
    }
    codeOneBlock() {
      let baseVal, complexState, curByte, distance, footerBits, len, lenToPosState, matchByte, pos, posReduced, posSlot, posState, progressPosValuePrev, subCoder;
      this.processedInSize[0] = 0n;
      this.processedOutSize[0] = 0n;
      this.finished[0] = 1;
      progressPosValuePrev = this.nowPos64;
      if (this._inStream) {
        this._matchFinder._stream = this._inStream;
        this._matchFinder.init();
        this._needReleaseMFStream = 1;
        this._inStream = null;
      }
      if (this._finished) {
        return;
      }
      this._finished = 1;
      if (this.nowPos64 === 0n) {
        if (!this._matchFinder.getNumAvailableBytes()) {
          this.flushEncoding(Number(this.nowPos64 & 0xffffffffn));
          return;
        }
        this.readMatchDistances();
        posState = Number(this.nowPos64 & 0xffffffffn) & this._posStateMask;
        this.encodeBit(this._isMatch, (this._state << 4) + posState, 0);
        this._state = stateUpdateChar(this._state);
        curByte = this._matchFinder.getIndexByte(-this._additionalOffset);
        this.encodeLiteral(this.getSubCoder(Number(this.nowPos64 & 0xffffffffn), this._previousByte), curByte);
        this._previousByte = curByte;
        this._additionalOffset -= 1;
        this.nowPos64 += 1n;
      }
      if (!this._matchFinder.getNumAvailableBytes()) {
        this.flushEncoding(Number(this.nowPos64 & 0xffffffffn));
        return;
      }
      while (1) {
        len = this.getOptimumLength(Number(this.nowPos64 & 0xffffffffn));
        pos = this.backRes;
        posState = Number(this.nowPos64 & 0xffffffffn) & this._posStateMask;
        complexState = (this._state << 4) + posState;
        if (len == 1 && pos == -1) {
          this.encodeBit(this._isMatch, complexState, 0);
          curByte = this._matchFinder.getIndexByte(-this._additionalOffset);
          subCoder = this.getSubCoder(Number(this.nowPos64 & 0xffffffffn), this._previousByte);
          if (this._state < 7) {
            this.encodeLiteral(subCoder, curByte);
          } else {
            matchByte = this._matchFinder.getIndexByte(-this._repDistances[0] - 1 - this._additionalOffset);
            this.encodeMatched(subCoder, matchByte, curByte);
          }
          this._previousByte = curByte;
          this._state = stateUpdateChar(this._state);
        } else {
          this.encodeBit(this._isMatch, complexState, 1);
          if (pos < 4) {
            this.encodeBit(this._isRep, this._state, 1);
            if (!pos) {
              this.encodeBit(this._isRepG0, this._state, 0);
              if (len == 1) {
                this.encodeBit(this._isRep0Long, complexState, 0);
              } else {
                this.encodeBit(this._isRep0Long, complexState, 1);
              }
            } else {
              this.encodeBit(this._isRepG0, this._state, 1);
              if (pos == 1) {
                this.encodeBit(this._isRepG1, this._state, 0);
              } else {
                this.encodeBit(this._isRepG1, this._state, 1);
                this.encodeBit(this._isRepG2, this._state, pos - 2);
              }
            }
            if (len == 1) {
              this._state = this._state < 7 ? 9 : 11;
            } else {
              this.encodeLength(this._repMatchLenEncoder, len - 2, posState);
              this._state = this._state < 7 ? 8 : 11;
            }
            distance = this._repDistances[pos];
            if (pos != 0) {
              for (let i = pos; i >= 1; --i) {
                this._repDistances[i] = this._repDistances[i - 1];
              }
              this._repDistances[0] = distance;
            }
          } else {
            this.encodeBit(this._isRep, this._state, 0);
            this._state = this._state < 7 ? 7 : 10;
            this.encodeLength(this._lenEncoder, len - 2, posState);
            pos -= 4;
            posSlot = this.getPosSlot(pos);
            lenToPosState = getLenToPosState(len);
            this.encodeBitTree(this._posSlotEncoder[lenToPosState], posSlot);
            if (posSlot >= 4) {
              footerBits = (posSlot >> 1) - 1;
              baseVal = (2 | posSlot & 1) << footerBits;
              posReduced = pos - baseVal;
              if (posSlot < 14) {
                this.reverseEncodeRange(baseVal - posSlot - 1, footerBits, posReduced);
              } else {
                this.encodeDirectBits(posReduced >> 4, footerBits - 4);
                this.reverseEncode(posReduced & 15);
                this._alignPriceCount += 1;
              }
            }
            distance = pos;
            for (let i = 3; i >= 1; --i) {
              this._repDistances[i] = this._repDistances[i - 1];
            }
            this._repDistances[0] = distance;
            this._matchPriceCount += 1;
          }
          this._previousByte = this._matchFinder.getIndexByte(len - 1 - this._additionalOffset);
        }
        this._additionalOffset -= len;
        this.nowPos64 += BigInt(len);
        if (!this._additionalOffset) {
          if (this._matchPriceCount >= 128) {
            this.fillDistancesPrices();
          }
          if (this._alignPriceCount >= 16) {
            this.fillAlignPrices();
          }
          this.processedInSize[0] = this.nowPos64;
          this.processedOutSize[0] = this.getProcessedSizeAdd();
          if (!this._matchFinder.getNumAvailableBytes()) {
            this.flushEncoding(Number(this.nowPos64 & 0xffffffffn));
            return;
          }
          if (this.nowPos64 - progressPosValuePrev >= 0x1000n) {
            this._finished = 0;
            this.finished[0] = 0;
            return;
          }
        }
      }
    }
    createMatchFinder() {
      if (!this._matchFinder) {
        const binTree = new BinTreeMatchFinder();
        let numHashBytes = 4;
        if (!this._matchFinderType) {
          numHashBytes = 2;
        }
        binTree.setType(numHashBytes);
        this._matchFinder = binTree;
      }
      this.createLiteralEncoder();
      if (this._dictionarySize == this._dictionarySizePrev && this._numFastBytesPrev == this._numFastBytes) {
        return;
      }
      this._matchFinder.create(this._dictionarySize, this._numFastBytes, 4096, 274);
      this._dictionarySizePrev = this._dictionarySize;
      this._numFastBytesPrev = this._numFastBytes;
    }
    writeHeaderProperties(output) {
      this.properties[0] = (this._posStateBits * 5 + this._numLiteralPosStateBits) * 9 + this._numLiteralContextBits & 255;
      for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
        this.properties[1 + byteIndex] = this._dictionarySize >> 8 * byteIndex & 255;
      }
      for (let i = 0; i < 5; i++) {
        output.writeByte(this.properties[i]);
      }
    }
    initCompression(input, output, len, mode) {
      if (len < -1n) {
        throw new Error("invalid length " + len);
      }
      this.initialize();
      this.configure(mode);
      this.writeHeaderProperties(output);
      for (let i = 0; i < 64; i += 8) {
        output.writeByte(Number(len >> BigInt(i) & 0xffn) << 24 >> 24);
      }
      this._needReleaseMFStream = 0;
      this._inStream = input;
      this._finished = 0;
      this.createMatchFinder();
      this._rangeEncoder.stream = output;
      this.init();
      this.fillDistancesPrices();
      this.fillAlignPrices();
      this._lenEncoder.setTableSize(this._numFastBytes + 1 - 2);
      this._lenEncoder.updateTables(1 << this._posStateBits);
      this._repMatchLenEncoder.setTableSize(this._numFastBytes + 1 - 2);
      this._repMatchLenEncoder.updateTables(1 << this._posStateBits);
      this.nowPos64 = 0n;
    }
    compress(input, output, mode) {
      this.initCompression(input, output, BigInt(input.count), mode);
      do {
        this.codeOneBlock();
        if (this.finished[0]) {
          this.releaseStreams();
          break;
        }
      } while (true);
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/streams.js
  var InputBuffer = class {
    buf;
    pos = 0;
    count;
    constructor(data) {
      this.buf = data;
      this.count = data.length;
    }
    readByte() {
      if (this.pos >= this.count)
        return -1;
      return this.buf[this.pos++] & 255;
    }
    readBytes(dest, off, len) {
      if (this.pos >= this.count)
        return -1;
      len = Math.min(len, this.count - this.pos);
      dest.set(this.buf.subarray(this.pos, this.pos + len), off);
      this.pos += len;
      return len;
    }
    get remaining() {
      return this.count - this.pos;
    }
  };
  var OutputBuffer = class {
    buf;
    count = 0;
    constructor(capacity = 32) {
      this.buf = new Uint8Array(capacity);
    }
    grow(requiredSize) {
      const newSize = Math.max(this.buf.length * 2, requiredSize);
      const newBuf = new Uint8Array(newSize);
      newBuf.set(this.buf.subarray(0, this.count));
      this.buf = newBuf;
    }
    writeByte(b) {
      if (this.count >= this.buf.length) {
        this.grow(this.count + 1);
      }
      this.buf[this.count++] = b;
    }
    writeBytes(src, off, len) {
      const requiredSize = this.count + len;
      if (requiredSize > this.buf.length) {
        this.grow(requiredSize);
      }
      this.buf.set(src.subarray(off, off + len), this.count);
      this.count += len;
    }
    write(buf) {
      this.writeBytes(buf, 0, buf.length);
    }
    toArray() {
      return this.buf.slice(0, this.count);
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/lzma.js
  var MODES = {
    1: { searchDepth: 16, filterStrength: 64, modeIndex: 0 },
    2: { searchDepth: 20, filterStrength: 64, modeIndex: 0 },
    3: { searchDepth: 19, filterStrength: 64, modeIndex: 1 },
    4: { searchDepth: 20, filterStrength: 64, modeIndex: 1 },
    5: { searchDepth: 21, filterStrength: 128, modeIndex: 1 },
    6: { searchDepth: 22, filterStrength: 128, modeIndex: 1 },
    7: { searchDepth: 23, filterStrength: 128, modeIndex: 1 },
    8: { searchDepth: 24, filterStrength: 255, modeIndex: 1 },
    9: { searchDepth: 25, filterStrength: 255, modeIndex: 1 }
  };
  var LZMA = class {
    #encoder = new Encoder();
    #decoder = new Decoder();
    compress(data, mode = 5) {
      const inputData = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const output = new OutputBuffer(Math.max(32, Math.ceil(inputData.length * 1.2)));
      const input = new InputBuffer(inputData);
      this.#encoder.compress(input, output, MODES[mode]);
      const result = output.toArray();
      return new Int8Array(result.buffer, result.byteOffset, result.byteLength);
    }
    compressString(data, mode = 5) {
      return this.compress(new Uint8Array(this.#encodeString(data)), mode);
    }
    decompress(bytearray) {
      const inputData = bytearray instanceof ArrayBuffer ? new Uint8Array(bytearray) : bytearray;
      const output = new OutputBuffer(Math.max(32, inputData.length * 2));
      const input = new InputBuffer(inputData);
      this.#decoder.decompress(input, output);
      return output.toArray();
    }
    decompressString(bytearray) {
      const decodedByteArray = this.decompress(bytearray);
      const result = this.#decodeUTF8(decodedByteArray);
      if (typeof result === "string") {
        return result;
      }
      return String.fromCharCode(...result);
    }
    #encodeString(inputString) {
      const l = inputString.length;
      const chars = [];
      for (let i = 0; i < l; ++i) {
        chars[i] = inputString.charCodeAt(i);
      }
      const data = [];
      let elen = 0;
      for (let i = 0; i < l; ++i) {
        const ch = chars[i];
        if (ch >= 1 && ch <= 127) {
          data[elen++] = ch << 24 >> 24;
        } else if (!ch || ch >= 128 && ch <= 2047) {
          data[elen++] = (192 | ch >> 6 & 31) << 24 >> 24;
          data[elen++] = (128 | ch & 63) << 24 >> 24;
        } else {
          data[elen++] = (224 | ch >> 12 & 15) << 24 >> 24;
          data[elen++] = (128 | ch >> 6 & 63) << 24 >> 24;
          data[elen++] = (128 | ch & 63) << 24 >> 24;
        }
      }
      return data;
    }
    #decodeUTF8(utf) {
      let j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];
      for (let i = 0; i < l; ++i, ++j) {
        x = utf[i] & 255;
        if (!(x & 128)) {
          if (!x)
            return utf;
          charCodes[j] = x;
        } else if ((x & 224) == 192) {
          if (i + 1 >= l)
            return String.fromCharCode(...utf);
          y = utf[++i] & 255;
          if ((y & 192) != 128)
            return String.fromCharCode(...utf);
          charCodes[j] = (x & 31) << 6 | y & 63;
        } else if ((x & 240) == 224) {
          if (i + 2 >= l)
            return utf;
          y = utf[++i] & 255;
          if ((y & 192) != 128)
            return utf;
          z = utf[++i] & 255;
          if ((z & 192) != 128)
            return utf;
          charCodes[j] = (x & 15) << 12 | (y & 63) << 6 | z & 63;
        } else {
          return utf;
        }
        if (j == 16383) {
          buf.push(String.fromCharCode.apply(String, charCodes));
          j = -1;
        }
      }
      if (j > 0) {
        charCodes.length = j;
        buf.push(String.fromCharCode.apply(String, charCodes));
      }
      return buf.join("");
    }
  };

  // ../ws-probe/node_modules/@cjser/lzma1/lib/index.js
  function compress(data, mode = 5) {
    const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const result = new LZMA().compress(input, mode);
    return new Uint8Array(result);
  }
  function decompress(data) {
    const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const decompressedData = new LZMA().decompress(input);
    return new Uint8Array(decompressedData);
  }

  // ../ws-probe/node_modules/ygopro-yrp-encode/dist/index.mjs
  var SEED_COUNT = 8;
  var REPLAY_ID_YRP2 = 846230137;
  var REPLAY_COMPRESSED_FLAG = 1;
  var REPLAY_TAG_FLAG = 2;
  var REPLAY_SINGLE_MODE = 8;
  var DUEL_TAG_MODE = 32;
  var ReplayHeader = class {
    constructor() {
      this.id = 0;
      this.version = 0;
      this.flag = 0;
      this.seed = 0;
      this.dataSizeRaw = [0, 0, 0, 0];
      this.hash = 0;
      this.props = new Array(8).fill(0);
      this.seedSequence = [];
      this.headerVersion = 0;
      this.value1 = 0;
      this.value2 = 0;
      this.value3 = 0;
    }
    get dataSize() {
      return (this.dataSizeRaw[0] | 0 | (this.dataSizeRaw[1] | 0) << 8 | (this.dataSizeRaw[2] | 0) << 16 | (this.dataSizeRaw[3] | 0) << 24) >>> 0;
    }
    set dataSize(v) {
      const u = v >>> 0;
      this.dataSizeRaw = [
        u & 255,
        u >>> 8 & 255,
        u >>> 16 & 255,
        u >>> 24 & 255
      ];
    }
    get isTag() {
      return (this.flag & REPLAY_TAG_FLAG) !== 0;
    }
    get isCompressed() {
      return (this.flag & REPLAY_COMPRESSED_FLAG) !== 0;
    }
    get isSingleMode() {
      return (this.flag & REPLAY_SINGLE_MODE) !== 0;
    }
    /** Compose a standard 13-byte .lzma header (props[0..5) + uncompressed size (8 bytes LE)) */
    getLzmaHeader13() {
      const out = new Uint8Array(13);
      out.set(Uint8Array.from(this.props.slice(0, 5)), 0);
      out.set(Uint8Array.from(this.dataSizeRaw.slice(0, 4)), 5);
      out[9] = 0;
      out[10] = 0;
      out[11] = 0;
      out[12] = 0;
      return out;
    }
  };
  function concatBytes(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
  function u8ToI32(u) {
    return u | 0;
  }
  var MAX_RESPONSE_LENGTH = 255;
  function readHeader(r) {
    const h = new ReplayHeader();
    h.id = r.readUInt32();
    h.version = r.readUInt32();
    h.flag = r.readUInt32();
    h.seed = r.readUInt32();
    h.dataSizeRaw = r.readByteArray(4);
    h.hash = r.readUInt32();
    h.props = r.readByteArray(8);
    if (h.id === REPLAY_ID_YRP2) {
      h.seedSequence = [];
      for (let i = 0; i < SEED_COUNT; i++) h.seedSequence.push(r.readUInt32());
      h.headerVersion = r.readUInt32();
      h.value1 = r.readUInt32();
      h.value2 = r.readUInt32();
      h.value3 = r.readUInt32();
    }
    return h;
  }
  function writeHeader(w, h) {
    w.writeUInt32(h.id);
    w.writeUInt32(h.version);
    w.writeUInt32(h.flag);
    w.writeUInt32(h.seed);
    w.writeByteArray(h.dataSizeRaw);
    w.writeUInt32(h.hash);
    const props8 = new Array(8).fill(0).map((_, i) => (h.props[i] ?? 0) & 255);
    w.writeByteArray(props8);
    if (h.id === REPLAY_ID_YRP2) {
      for (let i = 0; i < SEED_COUNT; i++) w.writeUInt32(h.seedSequence[i] ?? 0);
      w.writeUInt32(h.headerVersion);
      w.writeUInt32(h.value1);
      w.writeUInt32(h.value2);
      w.writeUInt32(h.value3);
    }
  }
  function decompressBody(h, rawBody) {
    const lzmaPayload = concatBytes(h.getLzmaHeader13(), rawBody);
    return decompress(lzmaPayload);
  }
  function readDeckPack(r) {
    const len = r.readInt32();
    const out = [];
    for (let i = 0; i < len; i++) out.push(r.readInt32());
    return out;
  }
  function readDeck(r) {
    const deck = new YGOProDeck();
    deck.main = readDeckPack(r);
    deck.extra = readDeckPack(r);
    return deck;
  }
  function writeDeckPack(w, pack) {
    w.writeInt32(u8ToI32(pack.length));
    for (const id of pack) w.writeInt32(id | 0);
  }
  function writeDeck(w, d) {
    if (!d) {
      w.writeInt32(0);
      w.writeInt32(0);
      return;
    }
    writeDeckPack(w, d.main ?? []);
    writeDeckPack(w, d.extra ?? []);
  }
  function readResponses(r) {
    const out = [];
    while (r.remaining > 0) {
      try {
        const len = r.readUInt8();
        if (len === 0 || r.remaining < len) break;
        out.push(r.readBytes(len));
      } catch {
        break;
      }
    }
    return out;
  }
  function writeResponses(w, res) {
    for (const seg of res) {
      if (seg.length === 0 || seg.length > MAX_RESPONSE_LENGTH) continue;
      w.writeUInt8(seg.length);
      w.writeBytes(seg);
    }
  }
  function decodeUtf16leZ(bytes) {
    let end = bytes.length;
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) {
        end = i;
        break;
      }
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes.subarray(0, end)).toString("utf16le");
    }
    const TD = globalThis.TextDecoder;
    if (TD) {
      try {
        return new TD("utf-16le").decode(bytes.subarray(0, end));
      } catch {
      }
    }
    const codeUnits = [];
    for (let i = 0; i + 1 < end; i += 2) {
      codeUnits.push(bytes[i] | bytes[i + 1] << 8);
    }
    return String.fromCharCode(...codeUnits);
  }
  function encodeUtf16le(s) {
    if (typeof Buffer !== "undefined") {
      return Uint8Array.from(Buffer.from(s, "utf16le"));
    }
    const out = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) {
      const cu = s.charCodeAt(i);
      out[i * 2] = cu & 255;
      out[i * 2 + 1] = cu >>> 8 & 255;
    }
    return out;
  }
  var ByteReader = class {
    constructor(buf) {
      this.buf = buf;
      this.ptr = 0;
      this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    get remaining() {
      return this.buf.length - this.ptr;
    }
    readUInt8() {
      const v = this.view.getUint8(this.ptr);
      this.ptr += 1;
      return v;
    }
    readInt8() {
      const v = this.view.getInt8(this.ptr);
      this.ptr += 1;
      return v;
    }
    readUInt16() {
      const v = this.view.getUint16(this.ptr, true);
      this.ptr += 2;
      return v;
    }
    readInt16() {
      const v = this.view.getInt16(this.ptr, true);
      this.ptr += 2;
      return v;
    }
    readUInt32() {
      const v = this.view.getUint32(this.ptr, true);
      this.ptr += 4;
      return v >>> 0;
    }
    readInt32() {
      const v = this.view.getInt32(this.ptr, true);
      this.ptr += 4;
      return v | 0;
    }
    readBytes(len) {
      if (this.ptr + len > this.buf.length) {
        throw new Error(
          `readBytes out of range: want=${len}, remaining=${this.remaining}`
        );
      }
      const out = this.buf.subarray(this.ptr, this.ptr + len);
      this.ptr += len;
      return out;
    }
    readByteArray(len) {
      const b = this.readBytes(len);
      return Array.from(b);
    }
    readAll() {
      return this.buf.subarray(this.ptr);
    }
    /** fixed-size UTF-16LE string, null-terminated */
    readStringUtf16le(byteLen) {
      const raw = this.readBytes(byteLen);
      return decodeUtf16leZ(raw);
    }
  };
  var ByteWriter = class {
    constructor(initialSize = 256) {
      this.ptr = 0;
      this.buf = new Uint8Array(initialSize);
      this.view = new DataView(this.buf.buffer);
    }
    ensure(n) {
      const need = this.ptr + n;
      if (need <= this.buf.length) return;
      let next = this.buf.length;
      while (next < need) next = Math.max(256, next * 2);
      const nb = new Uint8Array(next);
      nb.set(this.buf, 0);
      this.buf = nb;
      this.view = new DataView(this.buf.buffer);
    }
    get length() {
      return this.ptr;
    }
    toUint8Array() {
      return this.buf.subarray(0, this.ptr);
    }
    writeUInt8(v) {
      this.ensure(1);
      this.view.setUint8(this.ptr, v & 255);
      this.ptr += 1;
    }
    writeInt32(v) {
      this.ensure(4);
      this.view.setInt32(this.ptr, v | 0, true);
      this.ptr += 4;
    }
    writeUInt16(v) {
      this.ensure(2);
      this.view.setUint16(this.ptr, v & 65535, true);
      this.ptr += 2;
    }
    writeUInt32(v) {
      this.ensure(4);
      this.view.setUint32(this.ptr, v >>> 0, true);
      this.ptr += 4;
    }
    writeBytes(bytes) {
      this.ensure(bytes.length);
      this.buf.set(bytes, this.ptr);
      this.ptr += bytes.length;
    }
    writeByteArray(values) {
      for (const v of values) this.writeUInt8(v);
    }
    /** fixed-size UTF-16LE string, zero-padded */
    writeStringUtf16leFixed(s, byteLen) {
      const raw = encodeUtf16le(s);
      const out = new Uint8Array(byteLen);
      out.set(raw.subarray(0, Math.min(raw.length, byteLen)));
      this.writeBytes(out);
    }
  };
  function decodeUtf8(bytes) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("utf8");
    }
    const TD = globalThis.TextDecoder;
    if (TD) {
      return new TD("utf-8").decode(bytes);
    }
    return String.fromCharCode(...bytes);
  }
  function encodeUtf8(s) {
    if (typeof Buffer !== "undefined") {
      return Uint8Array.from(Buffer.from(s, "utf8"));
    }
    const TE = globalThis.TextEncoder;
    if (TE) {
      return new TE().encode(s);
    }
    return Uint8Array.from(s.split("").map((c) => c.charCodeAt(0)));
  }
  var YGOProYrp = class {
    constructor(init = {}) {
      this.header = null;
      this.hostName = "";
      this.clientName = "";
      this.startLp = 0;
      this.startHand = 0;
      this.drawCount = 0;
      this.opt = 0;
      this.hostDeck = null;
      this.clientDeck = null;
      this.tagHostName = null;
      this.tagClientName = null;
      this.tagHostDeck = null;
      this.tagClientDeck = null;
      this.singleScript = null;
      this.responses = [];
      if (init.header) {
        const h = new ReplayHeader();
        h.id = init.header.id ?? 0;
        h.version = init.header.version ?? 0;
        h.flag = init.header.flag ?? 0;
        h.seed = init.header.seed ?? 0;
        h.dataSizeRaw = [...init.header.dataSizeRaw ?? [0, 0, 0, 0]];
        h.hash = init.header.hash ?? 0;
        h.props = [...init.header.props ?? []];
        h.seedSequence = [...init.header.seedSequence ?? []];
        h.headerVersion = init.header.headerVersion ?? 0;
        h.value1 = init.header.value1 ?? 0;
        h.value2 = init.header.value2 ?? 0;
        h.value3 = init.header.value3 ?? 0;
        this.header = h;
      } else if (init.header === null) {
        this.header = null;
      }
      if (init.hostName !== void 0) this.hostName = init.hostName;
      if (init.clientName !== void 0) this.clientName = init.clientName;
      if (init.startLp !== void 0) this.startLp = init.startLp;
      if (init.startHand !== void 0) this.startHand = init.startHand;
      if (init.drawCount !== void 0) this.drawCount = init.drawCount;
      if (init.opt !== void 0) this.opt = init.opt;
      if (init.hostDeck) {
        this.hostDeck = new YGOProDeck({
          main: [...init.hostDeck.main ?? []],
          extra: [...init.hostDeck.extra ?? []],
          side: [...init.hostDeck.side ?? []],
          name: init.hostDeck.name
        });
      } else if (init.hostDeck === null) {
        this.hostDeck = null;
      }
      if (init.clientDeck) {
        this.clientDeck = new YGOProDeck({
          main: [...init.clientDeck.main ?? []],
          extra: [...init.clientDeck.extra ?? []],
          side: [...init.clientDeck.side ?? []],
          name: init.clientDeck.name
        });
      } else if (init.clientDeck === null) {
        this.clientDeck = null;
      }
      if (init.tagHostName !== void 0) this.tagHostName = init.tagHostName;
      if (init.tagClientName !== void 0)
        this.tagClientName = init.tagClientName;
      if (init.tagHostDeck) {
        this.tagHostDeck = new YGOProDeck({
          main: [...init.tagHostDeck.main ?? []],
          extra: [...init.tagHostDeck.extra ?? []],
          side: [...init.tagHostDeck.side ?? []],
          name: init.tagHostDeck.name
        });
      } else if (init.tagHostDeck === null) {
        this.tagHostDeck = null;
      }
      if (init.tagClientDeck) {
        this.tagClientDeck = new YGOProDeck({
          main: [...init.tagClientDeck.main ?? []],
          extra: [...init.tagClientDeck.extra ?? []],
          side: [...init.tagClientDeck.side ?? []],
          name: init.tagClientDeck.name
        });
      } else if (init.tagClientDeck === null) {
        this.tagClientDeck = null;
      }
      if (init.singleScript !== void 0) this.singleScript = init.singleScript;
      if (init.responses)
        this.responses = init.responses.map((seg) => new Uint8Array(seg));
    }
    get isTag() {
      return this.header?.isTag ?? false;
    }
    get isCompressed() {
      return this.header?.isCompressed ?? false;
    }
    get isSingleMode() {
      return this.header?.isSingleMode ?? false;
    }
    /** Parse .yrp/.yrp2 bytes */
    fromYrp(payload) {
      const r0 = new ByteReader(payload);
      const h = readHeader(r0);
      const rawBody = r0.readAll();
      const body = h.isCompressed ? decompressBody(h, rawBody) : rawBody;
      const r = new ByteReader(body);
      this.header = h;
      this.hostName = r.readStringUtf16le(40);
      if (h.isTag) {
        this.tagHostName = r.readStringUtf16le(40);
        this.tagClientName = r.readStringUtf16le(40);
      } else {
        this.tagHostName = null;
        this.tagClientName = null;
      }
      this.clientName = r.readStringUtf16le(40);
      this.startLp = r.readInt32();
      this.startHand = r.readInt32();
      this.drawCount = r.readInt32();
      this.opt = r.readInt32();
      const isTagFromHeader = h.isTag;
      const isTagFromOpt = (this.opt & DUEL_TAG_MODE) !== 0;
      if (isTagFromHeader !== isTagFromOpt) {
        throw new Error("Replay tag flag mismatch between header and params.");
      }
      if (h.isSingleMode) {
        const slen = r.readUInt16();
        if (slen === 0 || slen > 255)
          throw new Error("Invalid single mode script length.");
        const raw = r.readBytes(slen);
        const filename = decodeUtf8(raw);
        if (!filename.startsWith("./single/"))
          throw new Error("Invalid single mode script path.");
        const scriptName = filename.slice(9);
        if (scriptName.includes("/") || scriptName.includes("\\")) {
          throw new Error("Invalid single mode script name.");
        }
        this.singleScript = scriptName;
        this.hostDeck = null;
        this.clientDeck = null;
        this.tagHostDeck = null;
        this.tagClientDeck = null;
      } else {
        this.singleScript = null;
        this.hostDeck = readDeck(r);
        if (h.isTag) {
          this.tagHostDeck = readDeck(r);
          this.tagClientDeck = readDeck(r);
        } else {
          this.tagHostDeck = null;
          this.tagClientDeck = null;
        }
        this.clientDeck = readDeck(r);
      }
      this.responses = readResponses(r);
      return this;
    }
    /** Serialize to .yrp/.yrp2 bytes (Uint8Array) */
    toYrp() {
      if (!this.header)
        throw new Error(
          "Header not initialized. Call fromYrp() or set header first."
        );
      const isTagFromHeader = this.header.isTag;
      const isTagFromOpt = (this.opt & DUEL_TAG_MODE) !== 0;
      if (isTagFromHeader !== isTagFromOpt) {
        throw new Error("Replay tag flag mismatch between header and params.");
      }
      const w = new ByteWriter(1024);
      w.writeStringUtf16leFixed(this.hostName ?? "", 40);
      if (this.header.isTag) {
        w.writeStringUtf16leFixed(this.tagHostName ?? "", 40);
        w.writeStringUtf16leFixed(this.tagClientName ?? "", 40);
      }
      w.writeStringUtf16leFixed(this.clientName ?? "", 40);
      w.writeInt32(this.startLp);
      w.writeInt32(this.startHand);
      w.writeInt32(this.drawCount);
      w.writeInt32(this.opt);
      if (this.header.isSingleMode) {
        if (!this.singleScript)
          throw new Error("singleScript is required for single mode replay.");
        if (this.singleScript.includes("/") || this.singleScript.includes("\\")) {
          throw new Error("Invalid single mode script name.");
        }
        const filename = `./single/${this.singleScript}`;
        const raw = encodeUtf8(filename);
        if (raw.length === 0 || raw.length > 255)
          throw new Error("Invalid single mode script length.");
        w.writeUInt16(raw.length);
        w.writeBytes(raw);
      } else {
        writeDeck(w, this.hostDeck);
        if (this.header.isTag) {
          writeDeck(w, this.tagHostDeck);
          writeDeck(w, this.tagClientDeck);
        }
        writeDeck(w, this.clientDeck);
      }
      writeResponses(w, this.responses);
      const bodyRaw = w.toUint8Array();
      this.header.dataSize = bodyRaw.length;
      let bodyOut = bodyRaw;
      if (this.header.isCompressed) {
        const compressedFull = compress(bodyRaw);
        if (compressedFull.length < 13)
          throw new Error("Invalid LZMA output: too short.");
        const props5 = compressedFull.subarray(0, 5);
        const newProps8 = new Array(8).fill(0);
        for (let i = 0; i < 5; i++) newProps8[i] = props5[i];
        for (let i = 5; i < 8; i++)
          newProps8[i] = (this.header.props[i] ?? 0) & 255;
        this.header.props = newProps8;
        bodyOut = compressedFull.subarray(13);
      }
      const hw = new ByteWriter(this.header.id === REPLAY_ID_YRP2 ? 96 : 64);
      writeHeader(hw, this.header);
      const headerBytes = hw.toUint8Array();
      return concatBytes(headerBytes, bodyOut);
    }
  };

  // ../ws-probe/node_modules/ygopro-msg-encode/dist/index.mjs
  var __defProp2 = Object.defineProperty;
  var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
  var __name = (target, value) => __defProp2(target, "name", { value, configurable: true });
  var __decorateClass = (decorators, target, key, kind) => {
    var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc2(target, key) : target;
    for (var i = decorators.length - 1, decorator; i >= 0; i--)
      if (decorator = decorators[i])
        result = (kind ? decorator(target, key, result) : decorator(result)) || result;
    if (kind && result) __defProp2(target, key, result);
    return result;
  };
  var Metadata = new Reflector();
  var reflector = new Reflector();
  var BinaryField = /* @__PURE__ */ __name((type, offset, length) => {
    if ((type === "utf8" || type === "utf16") && length == null) {
      throw new Error(`String type ${type} requires length parameter`);
    }
    return Metadata.set(
      "binaryField",
      { type, offset, length },
      "binaryFieldKeys"
    );
  }, "BinaryField");
  var isStaticInfo = /* @__PURE__ */ __name((info) => typeof info.offset === "number" && (info.length == null || typeof info.length === "number"), "isStaticInfo");
  var resolveLength = /* @__PURE__ */ __name((obj, length, key) => {
    return typeof length === "number" ? length : length(obj, key);
  }, "resolveLength");
  var getTypeSize = /* @__PURE__ */ __name((type) => {
    switch (type) {
      case "i8":
      case "u8":
        return 1;
      case "i16":
      case "u16":
        return 2;
      case "i32":
      case "u32":
        return 4;
      default:
        return 0;
    }
  }, "getTypeSize");
  var getFieldInfos = /* @__PURE__ */ __name((objOrClass) => {
    const fields = reflector.getArray("binaryFieldKeys", objOrClass).map((key) => ({
      key,
      info: reflector.get("binaryField", objOrClass, key)
    })).filter((s) => s.info);
    const staticInfos = fields.filter((s) => isStaticInfo(s.info));
    const dynamicInfos = fields.filter((s) => !isStaticInfo(s.info));
    return { fields, staticInfos, dynamicInfos };
  }, "getFieldInfos");
  var fillBinaryFields = /* @__PURE__ */ __name((obj, data, useClass) => {
    const { staticInfos, dynamicInfos } = getFieldInfos(useClass || obj);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const utf8Decoder = new TextDecoder("utf-8");
    const utf16Decoder = new TextDecoder("utf-16le");
    let totalSize = 0;
    const readValue = /* @__PURE__ */ __name((type, offset) => {
      const typeSize = getTypeSize(type);
      if (offset + typeSize > data.length) {
        throw new Error(
          `Data too short: need ${offset + typeSize} bytes, got ${data.length} bytes`
        );
      }
      switch (type) {
        case "i8":
          return view.getInt8(offset);
        case "u8":
          return view.getUint8(offset);
        case "i16":
          return view.getInt16(offset, true);
        case "u16":
          return view.getUint16(offset, true);
        case "i32":
          return view.getInt32(offset, true);
        case "u32":
          return view.getUint32(offset, true);
        default:
          throw new Error(`Unknown type: ${type}`);
      }
    }, "readValue");
    const readString = /* @__PURE__ */ __name((type, offset, byteLength) => {
      if (offset + byteLength > data.length) {
        throw new Error(
          `Data too short: need ${offset + byteLength} bytes, got ${data.length} bytes`
        );
      }
      const bytes = data.slice(offset, offset + byteLength);
      let nullIndex = -1;
      if (type === "utf8") {
        nullIndex = bytes.indexOf(0);
      } else if (type === "utf16") {
        for (let i = 0; i < bytes.length - 1; i += 2) {
          if (bytes[i] === 0 && bytes[i + 1] === 0) {
            nullIndex = i;
            break;
          }
        }
      }
      const actualBytes = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes;
      if (type === "utf8") {
        return utf8Decoder.decode(actualBytes);
      } else if (type === "utf16") {
        return utf16Decoder.decode(actualBytes);
      }
      throw new Error(`Unknown string type: ${type}`);
    }, "readString");
    const parseField = /* @__PURE__ */ __name((key, info) => {
      const offset = resolveLength(obj, info.offset, key);
      const type = info.type;
      if (typeof type === "function") {
        const Constructor = type();
        if (info.length != null) {
          const length = resolveLength(obj, info.length, key);
          const array = [];
          let currentOffset = offset;
          for (let i = 0; i < length; i++) {
            if (currentOffset >= data.length) {
              throw new Error(
                `Data too short: need more bytes for object array at offset ${currentOffset}, got ${data.length} bytes`
              );
            }
            const instance = new Constructor();
            const elementData = data.slice(currentOffset);
            const size = fillBinaryFields(instance, elementData, Constructor);
            array.push(instance);
            currentOffset += size;
          }
          obj[key] = array;
          totalSize = Math.max(totalSize, currentOffset);
        } else {
          if (offset >= data.length) {
            throw new Error(
              `Data too short: need more bytes for object at offset ${offset}, got ${data.length} bytes`
            );
          }
          const instance = new Constructor();
          const elementData = data.slice(offset);
          const size = fillBinaryFields(instance, elementData, Constructor);
          obj[key] = instance;
          totalSize = Math.max(totalSize, offset + size);
        }
        return;
      }
      if (type === "utf8" || type === "utf16") {
        const lengthValue = resolveLength(obj, info.length, key);
        const byteLength = type === "utf16" ? lengthValue * 2 : lengthValue;
        obj[key] = readString(type, offset, byteLength);
        totalSize = Math.max(totalSize, offset + byteLength);
        return;
      }
      const typeStr = type;
      const typeSize = getTypeSize(typeStr);
      if (info.length != null) {
        const length = resolveLength(obj, info.length, key);
        const array = [];
        for (let i = 0; i < length; i++) {
          array.push(readValue(typeStr, offset + i * typeSize));
        }
        obj[key] = array;
        totalSize = Math.max(totalSize, offset + length * typeSize);
      } else {
        obj[key] = readValue(typeStr, offset);
        totalSize = Math.max(totalSize, offset + typeSize);
      }
    }, "parseField");
    for (const { key, info } of staticInfos) {
      parseField(key, info);
    }
    for (const { key, info } of dynamicInfos) {
      parseField(key, info);
    }
    return totalSize;
  }, "fillBinaryFields");
  var toBinaryFields = /* @__PURE__ */ __name((obj, useClass) => {
    const { staticInfos, dynamicInfos } = getFieldInfos(useClass || obj);
    if (staticInfos.length === 0 && dynamicInfos.length === 0) {
      return new Uint8Array(0);
    }
    let totalSize = 0;
    for (const { key, info } of [...staticInfos, ...dynamicInfos]) {
      const offset = resolveLength(obj, info.offset, key);
      const type = info.type;
      if (typeof type === "function") {
        const Constructor = type();
        const value = obj[key];
        if (info.length != null) {
          const length = resolveLength(obj, info.length, key);
          let currentOffset = offset;
          for (let i = 0; i < length; i++) {
            if (value && value[i]) {
              const itemData = toBinaryFields(value[i], Constructor);
              currentOffset += itemData.length;
            }
          }
          totalSize = Math.max(totalSize, currentOffset);
        } else {
          if (value) {
            const itemData = toBinaryFields(value, Constructor);
            totalSize = Math.max(totalSize, offset + itemData.length);
          }
        }
      } else if (type === "utf8" || type === "utf16") {
        const lengthValue = resolveLength(obj, info.length, key);
        const byteLength = type === "utf16" ? lengthValue * 2 : lengthValue;
        totalSize = Math.max(totalSize, offset + byteLength);
      } else {
        const typeSize = getTypeSize(type);
        if (info.length != null) {
          const length = resolveLength(obj, info.length, key);
          totalSize = Math.max(totalSize, offset + length * typeSize);
        } else {
          totalSize = Math.max(totalSize, offset + typeSize);
        }
      }
    }
    const data = new Uint8Array(totalSize);
    const view = new DataView(data.buffer);
    const utf8Encoder = new TextEncoder();
    const writeValue = /* @__PURE__ */ __name((type, offset, value) => {
      switch (type) {
        case "i8":
          view.setInt8(offset, value);
          break;
        case "u8":
          view.setUint8(offset, value);
          break;
        case "i16":
          view.setInt16(offset, value, true);
          break;
        case "u16":
          view.setUint16(offset, value, true);
          break;
        case "i32":
          view.setInt32(offset, value, true);
          break;
        case "u32":
          view.setUint32(offset, value, true);
          break;
      }
    }, "writeValue");
    const writeString = /* @__PURE__ */ __name((type, offset, byteLength, value) => {
      if (type === "utf8") {
        const encoded = utf8Encoder.encode(value);
        const len = Math.min(encoded.length, byteLength);
        data.set(encoded.slice(0, len), offset);
      } else if (type === "utf16") {
        for (let i = 0; i < Math.min(value.length, byteLength / 2); i++) {
          view.setUint16(offset + i * 2, value.charCodeAt(i), true);
        }
      }
    }, "writeString");
    const writeField = /* @__PURE__ */ __name((key, info) => {
      const offset = resolveLength(obj, info.offset, key);
      const type = info.type;
      const value = obj[key];
      if (value === void 0 || value === null) {
        return;
      }
      if (typeof type === "function") {
        const Constructor = type();
        if (info.length != null) {
          const length = resolveLength(obj, info.length, key);
          let currentOffset = offset;
          for (let i = 0; i < length; i++) {
            if (value && i < value.length && value[i]) {
              const itemData = toBinaryFields(value[i], Constructor);
              data.set(itemData, currentOffset);
              currentOffset += itemData.length;
            } else {
              const emptyInstance = new Constructor();
              const itemData = toBinaryFields(emptyInstance, Constructor);
              currentOffset += itemData.length;
            }
          }
        } else {
          const itemData = toBinaryFields(value, Constructor);
          data.set(itemData, offset);
        }
        return;
      }
      if (type === "utf8" || type === "utf16") {
        const lengthValue = resolveLength(obj, info.length, key);
        const byteLength = type === "utf16" ? lengthValue * 2 : lengthValue;
        writeString(type, offset, byteLength, value);
        return;
      }
      const typeStr = type;
      const typeSize = getTypeSize(typeStr);
      if (info.length != null) {
        const length = resolveLength(obj, info.length, key);
        for (let i = 0; i < length; i++) {
          if (value && i < value.length && value[i] !== void 0 && value[i] !== null) {
            writeValue(typeStr, offset + i * typeSize, value[i]);
          }
        }
      } else {
        writeValue(typeStr, offset, value);
      }
    }, "writeField");
    for (const { key, info } of staticInfos) {
      writeField(key, info);
    }
    for (const { key, info } of dynamicInfos) {
      writeField(key, info);
    }
    return data;
  }, "toBinaryFields");
  var HostInfo = class {
    static {
      __name(this, "HostInfo");
    }
  };
  __decorateClass([
    BinaryField("u32", 0)
  ], HostInfo.prototype, "lflist", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], HostInfo.prototype, "rule", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], HostInfo.prototype, "mode", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], HostInfo.prototype, "duel_rule", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], HostInfo.prototype, "no_check_deck", 2);
  __decorateClass([
    BinaryField("u8", 8)
  ], HostInfo.prototype, "no_shuffle_deck", 2);
  __decorateClass([
    BinaryField("i32", 12)
  ], HostInfo.prototype, "start_lp", 2);
  __decorateClass([
    BinaryField("u8", 16)
  ], HostInfo.prototype, "start_hand", 2);
  __decorateClass([
    BinaryField("u8", 17)
  ], HostInfo.prototype, "draw_count", 2);
  __decorateClass([
    BinaryField("u16", 18)
  ], HostInfo.prototype, "time_limit", 2);
  var PayloadBase = class {
    static {
      __name(this, "PayloadBase");
    }
    static {
      this.identifier = 0;
    }
    get identifier() {
      return this.constructor.identifier;
    }
    fromPartial(data) {
      const safeData = typeof globalThis.structuredClone === "function" ? globalThis.structuredClone(data) : JSON.parse(JSON.stringify(data));
      Object.assign(this, safeData);
      return this;
    }
    fromPayload(data) {
      fillBinaryFields(this, data);
      return this;
    }
    toPayload() {
      return toBinaryFields(this);
    }
    copy() {
      const Constructor = this.constructor;
      const copied = new Constructor();
      return copied.fromPartial(this);
    }
  };
  var OcgcoreCommonConstants = {
    ACTIVITY_ATTACK: 5,
    ACTIVITY_BATTLE_PHASE: 6,
    ACTIVITY_CHAIN: 7,
    ACTIVITY_FLIPSUMMON: 4,
    ACTIVITY_NORMALSUMMON: 2,
    ACTIVITY_SPSUMMON: 3,
    ACTIVITY_SUMMON: 1,
    ATTRIBUTES_COUNT: 7,
    ATTRIBUTE_ALL: 127,
    ATTRIBUTE_DARK: 32,
    ATTRIBUTE_DEVINE: 64,
    ATTRIBUTE_EARTH: 1,
    ATTRIBUTE_FIRE: 4,
    ATTRIBUTE_LIGHT: 16,
    ATTRIBUTE_WATER: 2,
    ATTRIBUTE_WIND: 8,
    CARDDATA_ALIAS: 2,
    CARDDATA_ATTACK: 8,
    CARDDATA_ATTRIBUTE: 6,
    CARDDATA_CODE: 1,
    CARDDATA_DEFENSE: 9,
    CARDDATA_LEVEL: 5,
    CARDDATA_LINK_MARKER: 12,
    CARDDATA_LSCALE: 10,
    CARDDATA_RACE: 7,
    CARDDATA_RSCALE: 11,
    CARDDATA_SETCODE: 3,
    CARDDATA_TYPE: 4,
    CHINT_ATTRIBUTE: 4,
    CHINT_CARD: 2,
    CHINT_DESC_ADD: 6,
    CHINT_DESC_REMOVE: 7,
    CHINT_NUMBER: 5,
    CHINT_RACE: 3,
    CHINT_TURN: 1,
    CTOS_CHAT: 22,
    CTOS_CREATE_GAME: 17,
    CTOS_EXTERNAL_ADDRESS: 23,
    CTOS_HAND_RESULT: 3,
    CTOS_HS_KICK: 36,
    CTOS_HS_NOTREADY: 35,
    CTOS_HS_READY: 34,
    CTOS_HS_START: 37,
    CTOS_HS_TODUELIST: 32,
    CTOS_HS_TOOBSERVER: 33,
    CTOS_JOIN_GAME: 18,
    CTOS_LEAVE_GAME: 19,
    CTOS_PLAYER_INFO: 16,
    CTOS_REQUEST_FIELD: 48,
    CTOS_RESPONSE: 1,
    CTOS_SURRENDER: 20,
    CTOS_TIME_CONFIRM: 21,
    CTOS_TP_RESULT: 4,
    CTOS_UPDATE_DECK: 2,
    CURRENT_RULE: 5,
    DECKERROR_CARDCOUNT: 5,
    DECKERROR_EXTRACOUNT: 7,
    DECKERROR_LFLIST: 1,
    DECKERROR_MAINCOUNT: 6,
    DECKERROR_NOTAVAIL: 9,
    DECKERROR_OCGONLY: 2,
    DECKERROR_SIDECOUNT: 8,
    DECKERROR_TCGONLY: 3,
    DECKERROR_UNKNOWNCARD: 4,
    DUEL_ATTACK_FIRST_TURN: 2,
    DUEL_OBSOLETE_RULING: 8,
    DUEL_PSEUDO_SHUFFLE: 16,
    DUEL_RETURN_DECK_TOP: 128,
    DUEL_REVEAL_DECK_SEQ: 256,
    DUEL_SIMPLE_AI: 64,
    DUEL_STAGE_BEGIN: 0,
    DUEL_STAGE_DUELING: 3,
    DUEL_STAGE_END: 5,
    DUEL_STAGE_FINGER: 1,
    DUEL_STAGE_FIRSTGO: 2,
    DUEL_STAGE_SIDING: 4,
    DUEL_TAG_MODE: 32,
    DUEL_TEST_MODE: 1,
    EDESC_OPERATION: 1,
    EDESC_RESET: 2,
    ERRMSG_DECKERROR: 2,
    ERRMSG_JOINERROR: 1,
    ERRMSG_SIDEERROR: 3,
    ERRMSG_VERERROR: 4,
    FALSE: 0,
    GETEFFECT_ALL: 15,
    GETEFFECT_COPY: 4,
    GETEFFECT_GAIN: 2,
    GETEFFECT_GRANT: 8,
    GETEFFECT_INITIAL: 1,
    HINT_ATTRIB: 7,
    HINT_CARD: 10,
    HINT_CODE: 8,
    HINT_EFFECT: 5,
    HINT_EVENT: 1,
    HINT_MESSAGE: 2,
    HINT_MUSIC: 21,
    HINT_MUSIC_OGG: 23,
    HINT_NUMBER: 9,
    HINT_OPSELECTED: 4,
    HINT_RACE: 6,
    HINT_SELECTMSG: 3,
    HINT_SOUND: 22,
    HINT_ZONE: 11,
    LINK_MARKER_BOTTOM: 2,
    LINK_MARKER_BOTTOM_LEFT: 1,
    LINK_MARKER_BOTTOM_RIGHT: 4,
    LINK_MARKER_LEFT: 8,
    LINK_MARKER_RIGHT: 32,
    LINK_MARKER_TOP: 128,
    LINK_MARKER_TOP_LEFT: 64,
    LINK_MARKER_TOP_RIGHT: 256,
    LOCATION_DECK: 1,
    LOCATION_DECKBOT: 65537,
    LOCATION_DECKSHF: 131073,
    LOCATION_EXTRA: 64,
    LOCATION_FZONE: 256,
    LOCATION_GRAVE: 16,
    LOCATION_HAND: 2,
    LOCATION_MZONE: 4,
    LOCATION_ONFIELD: 12,
    LOCATION_OVERLAY: 128,
    LOCATION_PZONE: 512,
    LOCATION_REMOVED: 32,
    LOCATION_SZONE: 8,
    MASTER_RULE3: 3,
    MASTER_RULE_2020: 5,
    MODE_MATCH: 1,
    MODE_SINGLE: 0,
    MODE_TAG: 2,
    MSG_ADD_COUNTER: 101,
    MSG_AI_NAME: 163,
    MSG_ANNOUNCE_ATTRIB: 141,
    MSG_ANNOUNCE_CARD: 142,
    MSG_ANNOUNCE_NUMBER: 143,
    MSG_ANNOUNCE_RACE: 140,
    MSG_ATTACK: 110,
    MSG_ATTACK_DISABLED: 112,
    MSG_BATTLE: 111,
    MSG_BECOME_TARGET: 83,
    MSG_BE_CHAIN_TARGET: 121,
    MSG_CANCEL_TARGET: 97,
    MSG_CARD_HINT: 160,
    MSG_CARD_SELECTED: 80,
    MSG_CARD_TARGET: 96,
    MSG_CHAINED: 71,
    MSG_CHAINING: 70,
    MSG_CHAIN_DISABLED: 76,
    MSG_CHAIN_END: 74,
    MSG_CHAIN_NEGATED: 75,
    MSG_CHAIN_SOLVED: 73,
    MSG_CHAIN_SOLVING: 72,
    MSG_CONFIRM_CARDS: 31,
    MSG_CONFIRM_DECKTOP: 30,
    MSG_CONFIRM_EXTRATOP: 42,
    MSG_CREATE_RELATION: 122,
    MSG_CUSTOM_MSG: 180,
    MSG_DAMAGE: 91,
    MSG_DAMAGE_STEP_END: 114,
    MSG_DAMAGE_STEP_START: 113,
    MSG_DECK_TOP: 38,
    MSG_DRAW: 90,
    MSG_EQUIP: 93,
    MSG_FIELD_DISABLED: 56,
    MSG_FLIPSUMMONED: 65,
    MSG_FLIPSUMMONING: 64,
    MSG_HAND_RES: 133,
    MSG_HINT: 2,
    MSG_LPUPDATE: 94,
    MSG_MATCH_KILL: 170,
    MSG_MISSED_EFFECT: 120,
    MSG_MOVE: 50,
    MSG_NEW_PHASE: 41,
    MSG_NEW_TURN: 40,
    MSG_PAY_LPCOST: 100,
    MSG_PLAYER_HINT: 165,
    MSG_POS_CHANGE: 53,
    MSG_RANDOM_SELECTED: 81,
    MSG_RECOVER: 92,
    MSG_REFRESH_DECK: 34,
    MSG_RELEASE_RELATION: 123,
    MSG_RELOAD_FIELD: 162,
    MSG_REMOVE_COUNTER: 102,
    MSG_REQUEST_DECK: 8,
    MSG_RESET_TIME: 221,
    MSG_RETRY: 1,
    MSG_REVERSE_DECK: 37,
    MSG_ROCK_PAPER_SCISSORS: 132,
    MSG_SELECT_BATTLECMD: 10,
    MSG_SELECT_CARD: 15,
    MSG_SELECT_CHAIN: 16,
    MSG_SELECT_COUNTER: 22,
    MSG_SELECT_DISFIELD: 24,
    MSG_SELECT_EFFECTYN: 12,
    MSG_SELECT_IDLECMD: 11,
    MSG_SELECT_OPTION: 14,
    MSG_SELECT_PLACE: 18,
    MSG_SELECT_POSITION: 19,
    MSG_SELECT_SUM: 23,
    MSG_SELECT_TRIBUTE: 20,
    MSG_SELECT_UNSELECT_CARD: 26,
    MSG_SELECT_YESNO: 13,
    MSG_SET: 54,
    MSG_SHOW_HINT: 164,
    MSG_SHUFFLE_DECK: 32,
    MSG_SHUFFLE_EXTRA: 39,
    MSG_SHUFFLE_HAND: 33,
    MSG_SHUFFLE_SET_CARD: 36,
    MSG_SORT_CARD: 25,
    MSG_SPSUMMONED: 63,
    MSG_SPSUMMONING: 62,
    MSG_START: 4,
    MSG_SUMMONED: 61,
    MSG_SUMMONING: 60,
    MSG_SWAP: 55,
    MSG_SWAP_GRAVE_DECK: 35,
    MSG_TAG_SWAP: 161,
    MSG_TOSS_COIN: 130,
    MSG_TOSS_DICE: 131,
    MSG_UNEQUIP: 95,
    MSG_UPDATE_CARD: 7,
    MSG_UPDATE_DATA: 6,
    MSG_WAITING: 3,
    MSG_WIN: 5,
    NETPLAYER_TYPE_OBSERVER: 7,
    NETPLAYER_TYPE_PLAYER1: 0,
    NETPLAYER_TYPE_PLAYER2: 1,
    NETPLAYER_TYPE_PLAYER3: 2,
    NETPLAYER_TYPE_PLAYER4: 3,
    NETPLAYER_TYPE_PLAYER5: 4,
    NETPLAYER_TYPE_PLAYER6: 5,
    NETWORK_CLIENT_ID: 57078,
    NETWORK_SERVER_ID: 29736,
    NEW_MASTER_RULE: 4,
    NO_FLIP_EFFECT: 65536,
    OCGCORE_CREATE_ENABLE_LUA_COVERAGE: 1,
    OPCODE_ADD: 1073741824,
    OPCODE_AND: 1073741828,
    OPCODE_DIV: 1073741827,
    OPCODE_ISATTRIBUTE: 1073742084,
    OPCODE_ISCODE: 1073742080,
    OPCODE_ISRACE: 1073742083,
    OPCODE_ISSETCARD: 1073742081,
    OPCODE_ISTYPE: 1073742082,
    OPCODE_MUL: 1073741826,
    OPCODE_NEG: 1073741830,
    OPCODE_NOT: 1073741831,
    OPCODE_OR: 1073741829,
    OPCODE_SUB: 1073741825,
    OPERATION_CANCELED: -1,
    OPERATION_FAIL: 0,
    OPERATION_SUCCESS: 1,
    PHASE_BATTLE: 128,
    PHASE_BATTLE_START: 8,
    PHASE_BATTLE_STEP: 16,
    PHASE_DAMAGE: 32,
    PHASE_DAMAGE_CAL: 64,
    PHASE_DRAW: 1,
    PHASE_END: 512,
    PHASE_MAIN1: 4,
    PHASE_MAIN2: 256,
    PHASE_STANDBY: 2,
    PHINT_DESC_ADD: 6,
    PHINT_DESC_REMOVE: 7,
    PLAYERCHANGE_LEAVE: 11,
    PLAYERCHANGE_NOTREADY: 10,
    PLAYERCHANGE_OBSERVE: 8,
    PLAYERCHANGE_READY: 9,
    PLAYER_ALL: 3,
    PLAYER_NONE: 2,
    PLAYER_SELFDES: 5,
    POS_ATTACK: 3,
    POS_DEFENSE: 12,
    POS_FACEDOWN: 10,
    POS_FACEDOWN_ATTACK: 2,
    POS_FACEDOWN_DEFENSE: 8,
    POS_FACEUP: 5,
    POS_FACEUP_ATTACK: 1,
    POS_FACEUP_DEFENSE: 4,
    POS_REVEAL: 128,
    PROCESSOR_BUFFER_LEN: 268435455,
    PROCESSOR_END: 536870912,
    PROCESSOR_FLAG: 4026531840,
    PROCESSOR_NONE: 0,
    PROCESSOR_WAITING: 268435456,
    QUERY_ALIAS: 4,
    QUERY_ATTACK: 256,
    QUERY_ATTRIBUTE: 64,
    QUERY_BASE_ATTACK: 1024,
    QUERY_BASE_DEFENSE: 2048,
    QUERY_CODE: 1,
    QUERY_COUNTERS: 131072,
    QUERY_DEFENSE: 512,
    QUERY_EQUIP_CARD: 16384,
    QUERY_LEVEL: 16,
    QUERY_LINK: 8388608,
    QUERY_LSCALE: 2097152,
    QUERY_OVERLAY_CARD: 65536,
    QUERY_OWNER: 262144,
    QUERY_POSITION: 2,
    QUERY_RACE: 128,
    QUERY_RANK: 32,
    QUERY_REASON: 4096,
    QUERY_REASON_CARD: 8192,
    QUERY_RSCALE: 4194304,
    QUERY_STATUS: 524288,
    QUERY_TARGET_CARD: 32768,
    QUERY_TYPE: 8,
    RACES_COUNT: 26,
    RACE_ALL: 67108863,
    RACE_AQUA: 64,
    RACE_BEAST: 16384,
    RACE_BEASTWARRIOR: 32768,
    RACE_CREATORGOD: 4194304,
    RACE_CYBERSE: 16777216,
    RACE_DEVINE: 2097152,
    RACE_DINOSAUR: 65536,
    RACE_DRAGON: 8192,
    RACE_FAIRY: 4,
    RACE_FIEND: 8,
    RACE_FISH: 131072,
    RACE_ILLUSION: 33554432,
    RACE_INSECT: 2048,
    RACE_MACHINE: 32,
    RACE_PLANT: 1024,
    RACE_PSYCHO: 1048576,
    RACE_PYRO: 128,
    RACE_REPTILE: 524288,
    RACE_ROCK: 256,
    RACE_SEASERPENT: 262144,
    RACE_SPELLCASTER: 2,
    RACE_THUNDER: 4096,
    RACE_WARRIOR: 1,
    RACE_WINDBEAST: 512,
    RACE_WYRM: 8388608,
    RACE_ZOMBIE: 16,
    REASONS_PROCEDURE: 271056896,
    REASON_ACTION: 2147483648,
    REASON_ADJUST: 256,
    REASON_BATTLE: 32,
    REASON_COST: 128,
    REASON_DESTROY: 1,
    REASON_DISCARD: 16384,
    REASON_DISSUMMON: 4096,
    REASON_DRAW: 33554432,
    REASON_EFFECT: 64,
    REASON_FLIP: 8192,
    REASON_FUSION: 262144,
    REASON_LINK: 268435456,
    REASON_LOST_OVERLAY: 536870912,
    REASON_LOST_TARGET: 512,
    REASON_MAINTENANCE: 1073741824,
    REASON_MATERIAL: 8,
    REASON_RDAMAGE: 32768,
    REASON_REDIRECT: 67108864,
    REASON_RELEASE: 2,
    REASON_REPLACE: 16777216,
    REASON_RETURN: 131072,
    REASON_REVEAL: 134217728,
    REASON_RITUAL: 1048576,
    REASON_RRECOVER: 65536,
    REASON_RULE: 1024,
    REASON_SPSUMMON: 2048,
    REASON_SUMMON: 16,
    REASON_SYNCHRO: 524288,
    REASON_TEMPORARY: 4,
    REASON_XYZ: 2097152,
    RETURN_TEMP_REMOVE_TO_FIELD: 1,
    RETURN_TRAP_MONSTER_TO_SZONE: 2,
    SEQ_DECKBOTTOM: 1,
    SEQ_DECKSHUFFLE: 2,
    SEQ_DECKTOP: 0,
    SIZE_AI_NAME: 128,
    SIZE_HINT_MSG: 1024,
    SIZE_MESSAGE_BUFFER: 8192,
    SIZE_RETURN_VALUE: 256,
    STATUS_ACTIVATE_DISABLED: 262144,
    STATUS_ACT_FROM_HAND: 134217728,
    STATUS_ATTACK_CANCELED: 2097152,
    STATUS_BATTLE_DESTROYED: 16384,
    STATUS_BATTLE_RESULT: 64,
    STATUS_CANNOT_CHANGE_FORM: 256,
    STATUS_CHAINING: 65536,
    STATUS_CONTINUOUS_POS: 33554432,
    STATUS_COPYING_EFFECT: 32768,
    STATUS_DESTROY_CONFIRMED: 4096,
    STATUS_DISABLED: 1,
    STATUS_EFFECT_ENABLED: 1024,
    STATUS_EFFECT_REPLACED: 524288,
    STATUS_FLIP_SUMMONING: 1048576,
    STATUS_FLIP_SUMMON_DISABLED: 2147483648,
    STATUS_FLIP_SUMMON_TURN: 536870912,
    STATUS_FORBIDDEN: 67108864,
    STATUS_INITIALIZING: 4194304,
    STATUS_JUST_POS: 16777216,
    STATUS_LEAVE_CONFIRMED: 8192,
    STATUS_NO_LEVEL: 32,
    STATUS_OPPO_BATTLE: 268435456,
    STATUS_PROC_COMPLETE: 8,
    STATUS_SET_TURN: 16,
    STATUS_SPSUMMON_STEP: 128,
    STATUS_SPSUMMON_TURN: 1073741824,
    STATUS_SUMMONING: 512,
    STATUS_SUMMON_DISABLED: 131072,
    STATUS_SUMMON_TURN: 2048,
    STATUS_TO_DISABLE: 4,
    STATUS_TO_ENABLE: 2,
    STATUS_TO_HAND_WITHOUT_CONFIRM: 8388608,
    STOC_CHANGE_SIDE: 7,
    STOC_CHAT: 25,
    STOC_CREATE_GAME: 17,
    STOC_DECK_COUNT: 9,
    STOC_DUEL_END: 22,
    STOC_DUEL_START: 21,
    STOC_ERROR_MSG: 2,
    STOC_FIELD_FINISH: 48,
    STOC_GAME_MSG: 1,
    STOC_HAND_RESULT: 5,
    STOC_HS_PLAYER_CHANGE: 33,
    STOC_HS_PLAYER_ENTER: 32,
    STOC_HS_WATCH_CHANGE: 34,
    STOC_JOIN_GAME: 18,
    STOC_LEAVE_GAME: 20,
    STOC_REPLAY: 23,
    STOC_SELECT_HAND: 3,
    STOC_SELECT_TP: 4,
    STOC_SRVPRO_ROOMLIST: 49,
    STOC_TEAMMATE_SURRENDER: 35,
    STOC_TIME_LIMIT: 24,
    STOC_TP_RESULT: 6,
    STOC_TYPE_CHANGE: 19,
    STOC_WAITING_SIDE: 8,
    TRUE: 1,
    TYPES_EXTRA_DECK: 75505728,
    TYPE_CONTINUOUS: 131072,
    TYPE_COUNTER: 1048576,
    TYPE_DUAL: 2048,
    TYPE_EFFECT: 32,
    TYPE_EQUIP: 262144,
    TYPE_FIELD: 524288,
    TYPE_FLIP: 2097152,
    TYPE_FUSION: 64,
    TYPE_LINK: 67108864,
    TYPE_MONSTER: 1,
    TYPE_NORMAL: 16,
    TYPE_PENDULUM: 16777216,
    TYPE_QUICKPLAY: 65536,
    TYPE_RITUAL: 128,
    TYPE_SPELL: 2,
    TYPE_SPIRIT: 512,
    TYPE_SPSUMMON: 33554432,
    TYPE_SYNCHRO: 8192,
    TYPE_TOKEN: 16384,
    TYPE_TOON: 4194304,
    TYPE_TRAP: 4,
    TYPE_TRAPMONSTER: 256,
    TYPE_TUNER: 4096,
    TYPE_UNION: 1024,
    TYPE_XYZ: 8388608
  };
  var SECOND_CODE_CARDS = /* @__PURE__ */ new Set([
    78734254,
    // CARD_MARINE_DOLPHIN
    13857930,
    // CARD_TWINKLE_MOSS
    1784686,
    // CARD_TIMAEUS
    11082056,
    // CARD_CRITIAS
    46232525
    // CARD_HERMOS
  ]);
  function checkSetcode(setcode, value) {
    const settype = value & 4095;
    const setsubtype = value & 61440;
    return !!setcode && (setcode & 4095) === settype && (setcode & setsubtype) === setsubtype;
  }
  __name(checkSetcode, "checkSetcode");
  var CardData = class extends PayloadBase {
    static {
      __name(this, "CardData");
    }
    /**
     * Check if this card belongs to a specific setcode
     * @param value The setcode value to check against
     * @returns true if the card belongs to the setcode
     */
    isSetCard(value) {
      for (const x of this.setcode) {
        if (!x) {
          return false;
        }
        if (checkSetcode(x, value)) {
          return true;
        }
      }
      return false;
    }
    getOriginalCode() {
      return this.alias ? this.alias : this.code;
    }
    getDuelCode() {
      return this.ruleCode ? this.ruleCode : this.getOriginalCode();
    }
    /**
     * Check if this card can be declared with the given opcode filter
     * @param opcode Array of opcodes that define the filter expression
     * @returns true if the card can be declared
     */
    isDeclarable(opcode) {
      if (this.alias) {
        return false;
      }
      const stack = [];
      for (const it of opcode) {
        switch (it) {
          case OcgcoreCommonConstants.OPCODE_ADD: {
            if (stack.length >= 2) {
              const rhs = stack.pop();
              const lhs = stack.pop();
              stack.push(lhs + rhs);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_SUB: {
            if (stack.length >= 2) {
              const rhs = stack.pop();
              const lhs = stack.pop();
              stack.push(lhs - rhs);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_MUL: {
            if (stack.length >= 2) {
              const rhs = stack.pop();
              const lhs = stack.pop();
              stack.push(lhs * rhs);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_DIV: {
            if (stack.length >= 2) {
              const rhs = stack.pop();
              const lhs = stack.pop();
              stack.push(rhs !== 0 ? Math.floor(lhs / rhs) : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_AND: {
            if (stack.length >= 2) {
              const rhs = stack.pop();
              const lhs = stack.pop();
              stack.push(lhs && rhs ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_OR: {
            if (stack.length >= 2) {
              const rhs = stack.pop();
              const lhs = stack.pop();
              stack.push(lhs || rhs ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_NEG: {
            if (stack.length >= 1) {
              const val = stack.pop();
              stack.push(-val);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_NOT: {
            if (stack.length >= 1) {
              const val = stack.pop();
              stack.push(!val ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_ISCODE: {
            if (stack.length >= 1) {
              const code = stack.pop();
              stack.push(this.code === code ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_ISSETCARD: {
            if (stack.length >= 1) {
              const setCode = stack.pop();
              const res = this.isSetCard(setCode);
              stack.push(res ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_ISTYPE: {
            if (stack.length >= 1) {
              const val = stack.pop();
              stack.push(this.type & val ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_ISRACE: {
            if (stack.length >= 1) {
              const raceVal = stack.pop();
              stack.push(this.race & raceVal ? 1 : 0);
            }
            break;
          }
          case OcgcoreCommonConstants.OPCODE_ISATTRIBUTE: {
            if (stack.length >= 1) {
              const attributeVal = stack.pop();
              stack.push(this.attribute & attributeVal ? 1 : 0);
            }
            break;
          }
          default: {
            stack.push(it);
            break;
          }
        }
      }
      if (stack.length !== 1 || stack[0] === 0) {
        return false;
      }
      if (!SECOND_CODE_CARDS.has(this.code) && (this.ruleCode || this.type & OcgcoreCommonConstants.TYPE_TOKEN)) {
        return false;
      }
      return true;
    }
  };
  __decorateClass([
    BinaryField("u32", 0)
  ], CardData.prototype, "code", 2);
  __decorateClass([
    BinaryField("u32", 4)
  ], CardData.prototype, "alias", 2);
  __decorateClass([
    BinaryField("u16", 8, 16)
  ], CardData.prototype, "setcode", 2);
  __decorateClass([
    BinaryField("u32", 40)
  ], CardData.prototype, "type", 2);
  __decorateClass([
    BinaryField("u32", 44)
  ], CardData.prototype, "level", 2);
  __decorateClass([
    BinaryField("u32", 48)
  ], CardData.prototype, "attribute", 2);
  __decorateClass([
    BinaryField("u32", 52)
  ], CardData.prototype, "race", 2);
  __decorateClass([
    BinaryField("i32", 56)
  ], CardData.prototype, "attack", 2);
  __decorateClass([
    BinaryField("i32", 60)
  ], CardData.prototype, "defense", 2);
  __decorateClass([
    BinaryField("u32", 64)
  ], CardData.prototype, "lscale", 2);
  __decorateClass([
    BinaryField("u32", 68)
  ], CardData.prototype, "rscale", 2);
  __decorateClass([
    BinaryField("u32", 72)
  ], CardData.prototype, "linkMarker", 2);
  __decorateClass([
    BinaryField("u32", 76)
  ], CardData.prototype, "ruleCode", 2);
  var LegacyPublicRevealViewSanitizeOptions = {
    stripRevealFlag: true,
    omitRevealField: true
  };
  function stripRevealFromPosition(position) {
    return position & ~OcgcoreCommonConstants.POS_REVEAL & 255;
  }
  __name(stripRevealFromPosition, "stripRevealFromPosition");
  function decodePublicRevealPosition(target, rawPosition = target.position) {
    if (typeof rawPosition !== "number") {
      return target;
    }
    const position = rawPosition & 255;
    target.position = stripRevealFromPosition(position);
    if (position & OcgcoreCommonConstants.POS_REVEAL) {
      target.reveal = true;
    } else {
      delete target.reveal;
    }
    return target;
  }
  __name(decodePublicRevealPosition, "decodePublicRevealPosition");
  function encodePublicRevealPosition(position, reveal) {
    const stripped = stripRevealFromPosition(position || 0);
    if (reveal === true) {
      return (stripped | OcgcoreCommonConstants.POS_REVEAL) & 255;
    }
    return stripped;
  }
  __name(encodePublicRevealPosition, "encodePublicRevealPosition");
  function sanitizePublicRevealPositionForView(target, options = LegacyPublicRevealViewSanitizeOptions) {
    if (!target) {
      return target;
    }
    if (options.stripRevealFlag && typeof target.position === "number") {
      target.position = stripRevealFromPosition(target.position);
    }
    if (options.omitRevealField) {
      delete target.reveal;
    }
    return target;
  }
  __name(sanitizePublicRevealPositionForView, "sanitizePublicRevealPositionForView");
  function shouldHideFacedownCode(position, reveal) {
    return !!(position && position & OcgcoreCommonConstants.POS_FACEDOWN && reveal !== true);
  }
  __name(shouldHideFacedownCode, "shouldHideFacedownCode");
  var CardQuery_CardLocation = class {
    static {
      __name(this, "CardQuery_CardLocation");
    }
  };
  var CardQuery_Counter = class {
    static {
      __name(this, "CardQuery_Counter");
    }
  };
  var CardQuery = class {
    constructor() {
      this.flags = 0;
    }
    static {
      __name(this, "CardQuery");
    }
    fromPayload(data) {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      let offset = 0;
      this.flags = view.getInt32(offset, true) >>> 0;
      offset += 4;
      if (this.flags === 0) {
        this.empty = true;
        return this;
      }
      this.empty = false;
      if (this.flags & OcgcoreCommonConstants.QUERY_CODE) {
        this.code = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_POSITION) {
        const pdata = view.getUint32(offset, true);
        this.controller = pdata & 255;
        this.location = pdata >>> 8 & 255;
        this.sequence = pdata >>> 16 & 255;
        this.position = (pdata >>> 24 & 255) >>> 0;
        decodePublicRevealPosition(this);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_ALIAS) {
        this.alias = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_TYPE) {
        this.type = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_LEVEL) {
        this.level = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_RANK) {
        this.rank = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_ATTRIBUTE) {
        this.attribute = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_RACE) {
        this.race = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_ATTACK) {
        this.attack = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_DEFENSE) {
        this.defense = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_BASE_ATTACK) {
        this.baseAttack = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_BASE_DEFENSE) {
        this.baseDefense = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_REASON) {
        this.reason = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_REASON_CARD) {
        this.reasonCard = {
          controller: view.getUint8(offset),
          location: view.getUint8(offset + 1),
          sequence: view.getUint8(offset + 2),
          position: view.getUint8(offset + 3)
        };
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_EQUIP_CARD) {
        this.equipCard = {
          controller: view.getUint8(offset),
          location: view.getUint8(offset + 1),
          sequence: view.getUint8(offset + 2),
          position: view.getUint8(offset + 3)
        };
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_TARGET_CARD) {
        const count = view.getInt32(offset, true);
        offset += 4;
        this.targetCards = [];
        for (let i = 0; i < count; i++) {
          this.targetCards.push({
            controller: view.getUint8(offset),
            location: view.getUint8(offset + 1),
            sequence: view.getUint8(offset + 2),
            position: view.getUint8(offset + 3)
          });
          offset += 4;
        }
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_OVERLAY_CARD) {
        const count = view.getInt32(offset, true);
        offset += 4;
        this.overlayCards = [];
        for (let i = 0; i < count; i++) {
          this.overlayCards.push(view.getInt32(offset, true));
          offset += 4;
        }
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_COUNTERS) {
        const count = view.getInt32(offset, true);
        offset += 4;
        this.counters = [];
        for (let i = 0; i < count; i++) {
          this.counters.push({
            type: view.getUint16(offset, true),
            count: view.getUint16(offset + 2, true)
          });
          offset += 4;
        }
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_OWNER) {
        this.owner = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_STATUS) {
        this.status = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_LSCALE) {
        this.lscale = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_RSCALE) {
        this.rscale = view.getInt32(offset, true);
        offset += 4;
      }
      if (this.flags & OcgcoreCommonConstants.QUERY_LINK) {
        this.link = view.getInt32(offset, true);
        offset += 4;
        this.linkMarker = view.getInt32(offset, true);
        offset += 4;
      }
      return this;
    }
    toPayload() {
      return serializeCardQuery(this);
    }
  };
  function serializeCardQuery(card) {
    const source = card || {};
    const flags = source.flags || 0;
    let size = 4;
    if (flags & OcgcoreCommonConstants.QUERY_CODE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_POSITION) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_ALIAS) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_TYPE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_LEVEL) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_RANK) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_ATTRIBUTE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_RACE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_ATTACK) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_DEFENSE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_BASE_ATTACK) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_BASE_DEFENSE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_REASON) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_REASON_CARD) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_EQUIP_CARD) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_TARGET_CARD) {
      size += 4 + (source.targetCards?.length || 0) * 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_OVERLAY_CARD) {
      size += 4 + (source.overlayCards?.length || 0) * 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_COUNTERS) {
      size += 4 + (source.counters?.length || 0) * 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_OWNER) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_STATUS) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_LSCALE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_RSCALE) size += 4;
    if (flags & OcgcoreCommonConstants.QUERY_LINK) size += 8;
    const result = new Uint8Array(size);
    const view = new DataView(result.buffer);
    let offset = 0;
    view.setInt32(offset, flags, true);
    offset += 4;
    if (source.empty || flags === 0) {
      return result;
    }
    if (flags & OcgcoreCommonConstants.QUERY_CODE) {
      view.setInt32(offset, source.code || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_POSITION) {
      const position = encodePublicRevealPosition(
        source.position,
        source.reveal
      );
      const pdata = (source.controller || 0) & 255 | ((source.location || 0) & 255) << 8 | ((source.sequence || 0) & 255) << 16 | (position & 255) << 24;
      view.setUint32(offset, pdata, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_ALIAS) {
      view.setInt32(offset, source.alias || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_TYPE) {
      view.setInt32(offset, source.type || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_LEVEL) {
      view.setInt32(offset, source.level || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_RANK) {
      view.setInt32(offset, source.rank || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_ATTRIBUTE) {
      view.setInt32(offset, source.attribute || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_RACE) {
      view.setInt32(offset, source.race || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_ATTACK) {
      view.setInt32(offset, source.attack || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_DEFENSE) {
      view.setInt32(offset, source.defense || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_BASE_ATTACK) {
      view.setInt32(offset, source.baseAttack || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_BASE_DEFENSE) {
      view.setInt32(offset, source.baseDefense || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_REASON) {
      view.setInt32(offset, source.reason || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_REASON_CARD) {
      const reasonCard = source.reasonCard || {
        controller: 0,
        location: 0,
        sequence: 0,
        position: 0
      };
      view.setUint8(offset, reasonCard.controller);
      view.setUint8(offset + 1, reasonCard.location);
      view.setUint8(offset + 2, reasonCard.sequence);
      view.setUint8(offset + 3, reasonCard.position || 0);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_EQUIP_CARD) {
      const equipCard = source.equipCard || {
        controller: 0,
        location: 0,
        sequence: 0,
        position: 0
      };
      view.setUint8(offset, equipCard.controller);
      view.setUint8(offset + 1, equipCard.location);
      view.setUint8(offset + 2, equipCard.sequence);
      view.setUint8(offset + 3, equipCard.position || 0);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_TARGET_CARD) {
      const targets = source.targetCards || [];
      view.setInt32(offset, targets.length, true);
      offset += 4;
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        view.setUint8(offset, target.controller);
        view.setUint8(offset + 1, target.location);
        view.setUint8(offset + 2, target.sequence);
        view.setUint8(offset + 3, target.position || 0);
        offset += 4;
      }
    }
    if (flags & OcgcoreCommonConstants.QUERY_OVERLAY_CARD) {
      const overlays = source.overlayCards || [];
      view.setInt32(offset, overlays.length, true);
      offset += 4;
      for (const card2 of overlays) {
        view.setInt32(offset, card2, true);
        offset += 4;
      }
    }
    if (flags & OcgcoreCommonConstants.QUERY_COUNTERS) {
      const counters = source.counters || [];
      view.setInt32(offset, counters.length, true);
      offset += 4;
      for (const counter of counters) {
        view.setUint16(offset, counter.type, true);
        view.setUint16(offset + 2, counter.count, true);
        offset += 4;
      }
    }
    if (flags & OcgcoreCommonConstants.QUERY_OWNER) {
      view.setInt32(offset, source.owner || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_STATUS) {
      view.setInt32(offset, source.status || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_LSCALE) {
      view.setInt32(offset, source.lscale || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_RSCALE) {
      view.setInt32(offset, source.rscale || 0, true);
      offset += 4;
    }
    if (flags & OcgcoreCommonConstants.QUERY_LINK) {
      view.setInt32(offset, source.link || 0, true);
      offset += 4;
      view.setInt32(offset, source.linkMarker || 0, true);
      offset += 4;
    }
    return new Uint8Array(view.buffer, view.byteOffset, offset);
  }
  __name(serializeCardQuery, "serializeCardQuery");
  function parseCardQueryChunk(data, offset = 0, context = "CardQuery") {
    if (offset + 4 > data.length) {
      throw new Error(`${context} chunk header truncated`);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const length = view.getInt32(offset, true);
    if (length < 4) {
      throw new Error(`${context} invalid chunk length: ${length}`);
    }
    if (offset + length > data.length) {
      throw new Error(`${context} chunk payload truncated`);
    }
    const card = new CardQuery();
    card.queryLength = length;
    if (length === 4) {
      card.flags = 0;
      card.empty = true;
      return { card, length };
    }
    const payload = data.slice(offset + 4, offset + length);
    card.fromPayload(payload);
    return { card, length };
  }
  __name(parseCardQueryChunk, "parseCardQueryChunk");
  function serializeCardQueryChunk(card) {
    const flags = card?.flags ?? 0;
    const queryLength = card?.queryLength;
    if (flags === 0 && card?.empty && (!queryLength || queryLength <= 4)) {
      return { length: 4, payload: new Uint8Array(0) };
    }
    if (flags === 0 && queryLength && queryLength > 4) {
      return { length: queryLength, payload: new Uint8Array(queryLength - 4) };
    }
    const payload = serializeCardQuery(card);
    const minimalLength = 4 + payload.length;
    if (queryLength && queryLength > minimalLength) {
      const padded = new Uint8Array(queryLength - 4);
      padded.set(payload, 0);
      return { length: queryLength, payload: padded };
    }
    return { length: minimalLength, payload };
  }
  __name(serializeCardQueryChunk, "serializeCardQueryChunk");
  function inferCardQueryChunkLength(source) {
    if (!source) {
      return void 0;
    }
    if (typeof source.queryLength === "number" && source.queryLength >= 4) {
      return source.queryLength;
    }
    const flags = source.flags ?? 0;
    if (flags === 0 && source.empty) {
      return 4;
    }
    const payload = serializeCardQuery(source);
    return 4 + payload.length;
  }
  __name(inferCardQueryChunkLength, "inferCardQueryChunkLength");
  function createClearedCardQuery(source) {
    const card = new CardQuery();
    card.flags = 0;
    card.empty = true;
    card.queryLength = inferCardQueryChunkLength(source);
    return card;
  }
  __name(createClearedCardQuery, "createClearedCardQuery");
  function createCodeHiddenCardQuery(source) {
    const card = new CardQuery();
    card.flags = OcgcoreCommonConstants.QUERY_CODE;
    card.code = 0;
    card.empty = false;
    card.queryLength = inferCardQueryChunkLength(source);
    return card;
  }
  __name(createCodeHiddenCardQuery, "createCodeHiddenCardQuery");
  function getCardQueryPosition(card) {
    if (!card) {
      return void 0;
    }
    return typeof card.position === "number" ? stripRevealFromPosition(card.position) : void 0;
  }
  __name(getCardQueryPosition, "getCardQueryPosition");
  var YGOProProtoBase = class extends PayloadBase {
    static {
      __name(this, "YGOProProtoBase");
    }
    static {
      this.messageDirection = "";
    }
    get messageDirection() {
      return this.constructor.messageDirection;
    }
    /**
     * Serialize to full payload including header (length + identifier + body)
     * Format: [length 2 bytes LE][identifier 1 byte][body]
     * Length = 1 (identifier) + body.length
     */
    toFullPayload() {
      const body = this.toPayload();
      const length = 1 + body.length;
      const fullPayload = new Uint8Array(3 + body.length);
      fullPayload[0] = length & 255;
      fullPayload[1] = length >> 8 & 255;
      fullPayload[2] = this.identifier;
      fullPayload.set(body, 3);
      return fullPayload;
    }
    /**
     * Deserialize from full payload including header (length + identifier + body)
     * Format: [length 2 bytes LE][identifier 1 byte][body]
     * @param data - Full payload data
     * @returns this instance
     * @throws Error if data is too short or identifier mismatch
     */
    fromFullPayload(data) {
      if (data.length < 3) {
        throw new Error(
          `${this.messageDirection} payload too short: expected at least 3 bytes, got ${data.length}`
        );
      }
      const declaredLength = data[0] | data[1] << 8;
      const identifier = data[2];
      if (identifier !== this.identifier) {
        throw new Error(
          `${this.messageDirection} identifier mismatch: expected 0x${this.identifier.toString(16)}, got 0x${identifier.toString(16)}`
        );
      }
      const expectedTotalLength = 3 + declaredLength - 1;
      if (data.length < expectedTotalLength) {
        throw new Error(
          `${this.messageDirection} payload too short: declared length ${declaredLength} requires ${expectedTotalLength} bytes total, got ${data.length}`
        );
      }
      const bodyData = data.length > expectedTotalLength ? data.slice(3, expectedTotalLength) : data.slice(3);
      return this.fromPayload(bodyData);
    }
  };
  var YGOProCtosBase = class extends YGOProProtoBase {
    static {
      __name(this, "YGOProCtosBase");
    }
    static {
      this.messageDirection = "CTOS";
    }
  };
  var RegistryBase = class {
    constructor(payloadClass, options = {}) {
      this.payloadClass = payloadClass;
      this.options = options;
      this.protos = /* @__PURE__ */ new Map();
    }
    static {
      __name(this, "RegistryBase");
    }
    register(proto) {
      const identifier = proto.identifier;
      this.protos.set(identifier, proto);
    }
    get(identifier) {
      return this.protos.get(identifier);
    }
    getInstanceFromPayload(data) {
      const identifier = data[this.options.identifierOffset ?? 0];
      const proto = this.get(identifier);
      if (!proto) {
        return void 0;
      }
      return new proto().fromPayload(
        data.slice(this.options.dataOffset ?? 0)
      );
    }
    getInstancesFromPayload(data) {
      const instances = [];
      const identifierOffset = this.options.identifierOffset ?? 0;
      const dataOffset = this.options.dataOffset ?? 0;
      const minLength = Math.max(identifierOffset + 1, dataOffset);
      let remaining = data;
      while (remaining.length > 0) {
        if (remaining.length < minLength) {
          break;
        }
        try {
          const instance = this.getInstanceFromPayload(remaining);
          if (!instance) {
            break;
          }
          const consumed = dataOffset + instance.toPayload().length;
          if (consumed <= 0 || consumed > remaining.length) {
            break;
          }
          instances.push(instance);
          remaining = remaining.slice(consumed);
        } catch {
          break;
        }
      }
      return instances;
    }
  };
  var ProtoRegistryBase = class extends RegistryBase {
    static {
      __name(this, "ProtoRegistryBase");
    }
    constructor(payloadClass) {
      super(payloadClass, {
        identifierOffset: 2,
        dataOffset: 3
      });
    }
    getInstancesFromPayload(data) {
      const instances = [];
      let offset = 0;
      while (offset + 2 <= data.length) {
        const declaredLength = data[offset] | data[offset + 1] << 8;
        if (declaredLength <= 0) {
          break;
        }
        const packetLength = 2 + declaredLength;
        if (offset + packetLength > data.length) {
          break;
        }
        const chunk = data.slice(offset, offset + packetLength);
        const identifier = chunk[2];
        const proto = this.get(identifier);
        if (!proto) {
          break;
        }
        try {
          const instance = new proto().fromFullPayload(chunk);
          instances.push(instance);
        } catch {
          break;
        }
        offset += packetLength;
      }
      return instances;
    }
  };
  var YGOProCtosResponse = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosResponse");
    }
    static {
      this.identifier = 1;
    }
    fromPayload(data) {
      this.response = data;
      return this;
    }
    toPayload() {
      return this.response || new Uint8Array(0);
    }
  };
  var YGOProCtosUpdateDeck = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosUpdateDeck");
    }
    static {
      this.identifier = 2;
    }
    constructor() {
      super();
      this.deck = new YGOProDeck();
    }
    fromPayload(data) {
      this.deck = YGOProDeck.fromUpdateDeckPayload(data);
      return this;
    }
    toPayload() {
      return this.deck.toUpdateDeckPayload();
    }
    fromPartial(data) {
      if (data.deck) {
        this.deck = new YGOProDeck(data.deck);
      }
      return this;
    }
    copy() {
      const copied = new this.constructor();
      copied.deck = new YGOProDeck(this.deck);
      return copied;
    }
  };
  var YGOProCtosHandResult = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosHandResult");
    }
    static {
      this.identifier = 3;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProCtosHandResult.prototype, "res", 2);
  var YGOProCtosTpResult = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosTpResult");
    }
    static {
      this.identifier = 4;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProCtosTpResult.prototype, "res", 2);
  var YGOProCtosPlayerInfo = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosPlayerInfo");
    }
    static {
      this.identifier = 16;
    }
  };
  __decorateClass([
    BinaryField("utf16", 0, 20)
  ], YGOProCtosPlayerInfo.prototype, "name", 2);
  var YGOProCtosCreateGame = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosCreateGame");
    }
    static {
      this.identifier = 17;
    }
  };
  __decorateClass([
    BinaryField(() => HostInfo, 0)
  ], YGOProCtosCreateGame.prototype, "info", 2);
  __decorateClass([
    BinaryField("utf16", 20, 20)
  ], YGOProCtosCreateGame.prototype, "name", 2);
  __decorateClass([
    BinaryField("utf16", 60, 20)
  ], YGOProCtosCreateGame.prototype, "pass", 2);
  var YGOProCtosJoinGame = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosJoinGame");
    }
    static {
      this.identifier = 18;
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProCtosJoinGame.prototype, "version", 2);
  __decorateClass([
    BinaryField("u32", 4)
  ], YGOProCtosJoinGame.prototype, "gameid", 2);
  __decorateClass([
    BinaryField("utf16", 8, 20)
  ], YGOProCtosJoinGame.prototype, "pass", 2);
  var YGOProCtosLeaveGame = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosLeaveGame");
    }
    static {
      this.identifier = 19;
    }
  };
  var YGOProCtosSurrender = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosSurrender");
    }
    static {
      this.identifier = 20;
    }
  };
  var YGOProCtosTimeConfirm = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosTimeConfirm");
    }
    static {
      this.identifier = 21;
    }
  };
  var CTOS_CHAT_MAX_LENGTH = 256;
  var YGOProCtosChat = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosChat");
    }
    static {
      this.identifier = 22;
    }
    static {
      this.MAX_LENGTH = CTOS_CHAT_MAX_LENGTH;
    }
    constructor() {
      super();
      this.msg = "";
    }
    fromPayload(data) {
      const decoder = new TextDecoder("utf-16le");
      this.msg = decoder.decode(data).replace(/\0+$/, "");
      return this;
    }
    toPayload() {
      const text = this.msg.length > CTOS_CHAT_MAX_LENGTH ? this.msg.substring(0, CTOS_CHAT_MAX_LENGTH) : this.msg;
      const utf16 = new Uint16Array(text.length + 1);
      for (let i = 0; i < text.length; i++) {
        utf16[i] = text.charCodeAt(i);
      }
      utf16[text.length] = 0;
      const result = new Uint8Array(utf16.buffer);
      return result;
    }
    fromPartial(data) {
      if (data.msg !== void 0) {
        this.msg = data.msg;
      }
      return this;
    }
  };
  var CTOS_EXTERNAL_ADDRESS_MAX_HOSTNAME_LENGTH = 256;
  var YGOProCtosExternalAddress = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosExternalAddress");
    }
    static {
      this.identifier = 23;
    }
    static {
      this.MAX_LENGTH = CTOS_EXTERNAL_ADDRESS_MAX_HOSTNAME_LENGTH;
    }
    static {
      this.MAX_HOSTNAME_LENGTH = CTOS_EXTERNAL_ADDRESS_MAX_HOSTNAME_LENGTH;
    }
    constructor() {
      super();
      this.real_ip = "0.0.0.0";
      this.hostname = "";
    }
    // Convert IPv4 string to uint32 (network byte order / big endian)
    ipToUint32(ip) {
      let ipv4 = ip;
      if (ip.startsWith("::ffff:")) {
        ipv4 = ip.substring(7);
      }
      const parts = ipv4.split(".");
      if (parts.length !== 4) {
        return 0;
      }
      const bytes = parts.map((p) => parseInt(p, 10));
      if (bytes.some((b) => isNaN(b) || b < 0 || b > 255)) {
        return 0;
      }
      return bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3];
    }
    // Convert uint32 (network byte order / big endian) to IPv4 string
    uint32ToIp(value) {
      const byte1 = value >>> 24 & 255;
      const byte2 = value >>> 16 & 255;
      const byte3 = value >>> 8 & 255;
      const byte4 = value & 255;
      return `${byte1}.${byte2}.${byte3}.${byte4}`;
    }
    fromPayload(data) {
      if (data.length < 4) {
        throw new Error("CTOS_EXTERNAL_ADDRESS data too short");
      }
      const ipUint32 = data[0] << 24 | data[1] << 16 | data[2] << 8 | data[3];
      this.real_ip = this.uint32ToIp(ipUint32);
      if (data.length > 4) {
        const decoder = new TextDecoder("utf-16le");
        this.hostname = decoder.decode(data.slice(4)).replace(/\0+$/, "");
      } else {
        this.hostname = "";
      }
      return this;
    }
    toPayload() {
      const text = this.hostname.length > CTOS_EXTERNAL_ADDRESS_MAX_HOSTNAME_LENGTH ? this.hostname.substring(0, CTOS_EXTERNAL_ADDRESS_MAX_HOSTNAME_LENGTH) : this.hostname;
      const utf16 = new Uint16Array(text.length + 1);
      for (let i = 0; i < text.length; i++) {
        utf16[i] = text.charCodeAt(i);
      }
      utf16[text.length] = 0;
      const result = new Uint8Array(4 + utf16.byteLength);
      const ipUint32 = this.ipToUint32(this.real_ip);
      result[0] = ipUint32 >>> 24 & 255;
      result[1] = ipUint32 >>> 16 & 255;
      result[2] = ipUint32 >>> 8 & 255;
      result[3] = ipUint32 & 255;
      result.set(new Uint8Array(utf16.buffer), 4);
      return result;
    }
    fromPartial(data) {
      if (data.real_ip !== void 0) {
        this.real_ip = data.real_ip;
      }
      if (data.hostname !== void 0) {
        this.hostname = data.hostname;
      }
      return this;
    }
  };
  var YGOProCtosHsToDuelist = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosHsToDuelist");
    }
    static {
      this.identifier = 32;
    }
  };
  var YGOProCtosHsToObserver = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosHsToObserver");
    }
    static {
      this.identifier = 33;
    }
  };
  var YGOProCtosHsReady = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosHsReady");
    }
    static {
      this.identifier = 34;
    }
  };
  var YGOProCtosHsNotReady = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosHsNotReady");
    }
    static {
      this.identifier = 35;
    }
  };
  var YGOProCtosKick = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosKick");
    }
    static {
      this.identifier = 36;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProCtosKick.prototype, "pos", 2);
  var YGOProCtosHsStart = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosHsStart");
    }
    static {
      this.identifier = 37;
    }
  };
  var YGOProCtosRequestField = class extends YGOProCtosBase {
    static {
      __name(this, "YGOProCtosRequestField");
    }
    static {
      this.identifier = 48;
    }
  };
  var YGOProCtos = new ProtoRegistryBase(YGOProCtosBase);
  YGOProCtos.register(YGOProCtosResponse);
  YGOProCtos.register(YGOProCtosUpdateDeck);
  YGOProCtos.register(YGOProCtosHandResult);
  YGOProCtos.register(YGOProCtosTpResult);
  YGOProCtos.register(YGOProCtosPlayerInfo);
  YGOProCtos.register(YGOProCtosCreateGame);
  YGOProCtos.register(YGOProCtosJoinGame);
  YGOProCtos.register(YGOProCtosLeaveGame);
  YGOProCtos.register(YGOProCtosSurrender);
  YGOProCtos.register(YGOProCtosTimeConfirm);
  YGOProCtos.register(YGOProCtosChat);
  YGOProCtos.register(YGOProCtosExternalAddress);
  YGOProCtos.register(YGOProCtosHsToDuelist);
  YGOProCtos.register(YGOProCtosHsToObserver);
  YGOProCtos.register(YGOProCtosHsReady);
  YGOProCtos.register(YGOProCtosHsNotReady);
  YGOProCtos.register(YGOProCtosKick);
  YGOProCtos.register(YGOProCtosHsStart);
  YGOProCtos.register(YGOProCtosRequestField);
  var YGOProStocBase = class extends YGOProProtoBase {
    static {
      __name(this, "YGOProStocBase");
    }
    static {
      this.messageDirection = "STOC";
    }
  };
  var SEND_TO_ALL = [
    0,
    1,
    7
    /* OBSERVER */
  ];
  var YGOProMsgBase = class extends PayloadBase {
    static {
      __name(this, "YGOProMsgBase");
    }
    fromPayload(data) {
      if (data.length < 1) {
        throw new Error("MSG data too short");
      }
      const msgType = data[0];
      if (msgType !== this.identifier) {
        throw new Error(
          `MSG type mismatch: expected ${this.identifier}, got ${msgType}`
        );
      }
      return super.fromPayload(data.slice(1));
    }
    toPayload() {
      const payload = super.toPayload();
      const result = new Uint8Array(1 + payload.length);
      result[0] = this.identifier;
      result.set(payload, 1);
      return result;
    }
    opponentView() {
      return this.copy();
    }
    teammateView() {
      return this.copy();
    }
    observerView() {
      return this.opponentView();
    }
    playerView(playerId) {
      if (playerId === 7) {
        return this.observerView();
      }
      if (typeof this["player"] === "number") {
        const selfPlayerId = this["player"];
        if (selfPlayerId === playerId) {
          return this.copy();
        }
        return this.opponentView();
      }
      return this.copy();
    }
    getSendTargets() {
      return SEND_TO_ALL;
    }
    getRequireRefreshZones() {
      return [];
    }
    getRequireRefreshCards() {
      return [];
    }
  };
  var YGOProMsgAddCounter = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgAddCounter");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ADD_COUNTER;
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProMsgAddCounter.prototype, "counterType", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgAddCounter.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgAddCounter.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgAddCounter.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u16", 5)
  ], YGOProMsgAddCounter.prototype, "count", 2);
  var YGOProMsgResponseBase = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgResponseBase");
    }
    defaultResponse() {
      return void 0;
    }
    responsePlayer() {
      return 0;
    }
    getSendTargets() {
      return [this.responsePlayer()];
    }
  };
  var YGOProMsgAnnounceAttrib = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgAnnounceAttrib");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ANNOUNCE_ATTRIB;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(attributes) {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, attributes, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgAnnounceAttrib.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgAnnounceAttrib.prototype, "count", 2);
  __decorateClass([
    BinaryField("u32", 2)
  ], YGOProMsgAnnounceAttrib.prototype, "availableAttributes", 2);
  var YGOProMsgAnnounceCard = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgAnnounceCard");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ANNOUNCE_CARD;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(cardCode) {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, cardCode, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgAnnounceCard.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgAnnounceCard.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgAnnounceCard.prototype, "opcodes", 2);
  var INDEX_RESPONSE_SYMBOL = /* @__PURE__ */ Symbol("IndexResponse");
  var IndexResponse = /* @__PURE__ */ __name((index) => ({
    [INDEX_RESPONSE_SYMBOL]: true,
    index
  }), "IndexResponse");
  var isIndexResponse = /* @__PURE__ */ __name((obj) => {
    return obj != null && obj[INDEX_RESPONSE_SYMBOL] === true;
  }, "isIndexResponse");
  var YGOProMsgAnnounceNumber = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgAnnounceNumber");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ANNOUNCE_NUMBER;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(option) {
      let index;
      if (isIndexResponse(option)) {
        index = option.index;
        if (index < 0 || index >= this.count) {
          throw new TypeError(`Index out of range: ${index}`);
        }
      } else {
        index = this.numbers.indexOf(option);
        if (index === -1) {
          throw new TypeError(`Number not found: ${option}`);
        }
      }
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, index, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgAnnounceNumber.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgAnnounceNumber.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgAnnounceNumber.prototype, "numbers", 2);
  var YGOProMsgAnnounceRace = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgAnnounceRace");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ANNOUNCE_RACE;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(races) {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, races, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgAnnounceRace.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgAnnounceRace.prototype, "count", 2);
  __decorateClass([
    BinaryField("u32", 2)
  ], YGOProMsgAnnounceRace.prototype, "availableRaces", 2);
  var YGOProMsgAttack_CardLocation = class {
    static {
      __name(this, "YGOProMsgAttack_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgAttack_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgAttack_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgAttack_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgAttack_CardLocation.prototype, "position", 2);
  var YGOProMsgAttack = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgAttack");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ATTACK;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgAttack_CardLocation, 0)
  ], YGOProMsgAttack.prototype, "attacker", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgAttack_CardLocation, 4)
  ], YGOProMsgAttack.prototype, "defender", 2);
  var YGOProMsgAttackDisabled = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgAttackDisabled");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ATTACK_DISABLED;
    }
  };
  var YGOProMsgBattle_CardLocation = class {
    static {
      __name(this, "YGOProMsgBattle_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgBattle_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgBattle_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgBattle_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgBattle_CardLocation.prototype, "position", 2);
  var YGOProMsgBattle_CardStats = class {
    static {
      __name(this, "YGOProMsgBattle_CardStats");
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgBattle_CardLocation, 0)
  ], YGOProMsgBattle_CardStats.prototype, "location", 2);
  __decorateClass([
    BinaryField("i32", 4)
  ], YGOProMsgBattle_CardStats.prototype, "atk", 2);
  __decorateClass([
    BinaryField("i32", 8)
  ], YGOProMsgBattle_CardStats.prototype, "def", 2);
  var YGOProMsgBattle = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgBattle");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_BATTLE;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgBattle_CardStats, 0)
  ], YGOProMsgBattle.prototype, "attacker", 2);
  __decorateClass([
    BinaryField("u8", 12)
  ], YGOProMsgBattle.prototype, "attackerBattleState", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgBattle_CardStats, 13)
  ], YGOProMsgBattle.prototype, "defender", 2);
  __decorateClass([
    BinaryField("u8", 25)
  ], YGOProMsgBattle.prototype, "defenderBattleState", 2);
  var YGOProMsgBecomeTarget = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgBecomeTarget");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_BECOME_TARGET;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgBecomeTarget.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 1, (obj) => obj.count)
  ], YGOProMsgBecomeTarget.prototype, "targets", 2);
  var YGOProMsgCancelTarget_CardLocation = class {
    static {
      __name(this, "YGOProMsgCancelTarget_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgCancelTarget_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgCancelTarget_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgCancelTarget_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgCancelTarget_CardLocation.prototype, "position", 2);
  var YGOProMsgCancelTarget = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgCancelTarget");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CANCEL_TARGET;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgCancelTarget_CardLocation, 0)
  ], YGOProMsgCancelTarget.prototype, "card1", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgCancelTarget_CardLocation, 4)
  ], YGOProMsgCancelTarget.prototype, "card2", 2);
  var YGOProMsgCardHint = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgCardHint");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CARD_HINT;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgCardHint.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgCardHint.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgCardHint.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgCardHint.prototype, "subsequence", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgCardHint.prototype, "type", 2);
  __decorateClass([
    BinaryField("i32", 5)
  ], YGOProMsgCardHint.prototype, "value", 2);
  var YGOProMsgCardTarget_CardLocation = class {
    static {
      __name(this, "YGOProMsgCardTarget_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgCardTarget_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgCardTarget_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgCardTarget_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgCardTarget_CardLocation.prototype, "position", 2);
  var YGOProMsgCardTarget = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgCardTarget");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CARD_TARGET;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgCardTarget_CardLocation, 0)
  ], YGOProMsgCardTarget.prototype, "card1", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgCardTarget_CardLocation, 4)
  ], YGOProMsgCardTarget.prototype, "card2", 2);
  var YGOProMsgChainDisabled = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChainDisabled");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAIN_DISABLED;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgChainDisabled.prototype, "chainCount", 2);
  var OcgcoreScriptConstants = {
    ACTIVITY_ATTACK: 5,
    ACTIVITY_BATTLE_PHASE: 6,
    ACTIVITY_CHAIN: 7,
    ACTIVITY_FLIPSUMMON: 4,
    ACTIVITY_NORMALSUMMON: 2,
    ACTIVITY_SPSUMMON: 3,
    ACTIVITY_SUMMON: 1,
    ASSUME_ATTACK: 7,
    ASSUME_ATTRIBUTE: 5,
    ASSUME_CODE: 1,
    ASSUME_DEFENSE: 8,
    ASSUME_LEVEL: 3,
    ASSUME_RACE: 6,
    ASSUME_RANK: 4,
    ASSUME_TYPE: 2,
    ATTRIBUTE_ALL: 127,
    ATTRIBUTE_DARK: 32,
    ATTRIBUTE_DIVINE: 64,
    ATTRIBUTE_EARTH: 1,
    ATTRIBUTE_FIRE: 4,
    ATTRIBUTE_LIGHT: 16,
    ATTRIBUTE_WATER: 2,
    ATTRIBUTE_WIND: 8,
    CARD_MARINE_DOLPHIN: 78734254,
    CARD_QUESTION: 38723936,
    CARD_TWINKLE_MOSS: 13857930,
    CATEGORY_ANNOUNCE: 536870912,
    CATEGORY_ATKCHANGE: 2097152,
    CATEGORY_COIN: 16777216,
    CATEGORY_CONTROL: 8192,
    CATEGORY_COUNTER: 8388608,
    CATEGORY_DAMAGE: 524288,
    CATEGORY_DECKDES: 64,
    CATEGORY_DEFCHANGE: 4194304,
    CATEGORY_DESTROY: 1,
    CATEGORY_DICE: 33554432,
    CATEGORY_DISABLE: 16384,
    CATEGORY_DISABLE_SUMMON: 32768,
    CATEGORY_DRAW: 65536,
    CATEGORY_EQUIP: 262144,
    CATEGORY_FUSION_SUMMON: 1073741824,
    CATEGORY_GRAVE_ACTION: 2048,
    CATEGORY_GRAVE_SPSUMMON: 134217728,
    CATEGORY_HANDES: 17179869312,
    CATEGORY_HANDES_OPPO: 17179869184,
    CATEGORY_HANDES_SELF: 128,
    CATEGORY_LEAVE_GRAVE: 67108864,
    CATEGORY_MSET: 4294967296,
    CATEGORY_NEGATE: 268435456,
    CATEGORY_POSITION: 4096,
    CATEGORY_RECOVER: 1048576,
    CATEGORY_RELEASE: 2,
    CATEGORY_REMOVE: 4,
    CATEGORY_SEARCH: 131072,
    CATEGORY_SPECIAL_SUMMON: 512,
    CATEGORY_SSET: 8589934592,
    CATEGORY_SUMMON: 256,
    CATEGORY_TODECK: 16,
    CATEGORY_TOEXTRA: 2147483648,
    CATEGORY_TOGRAVE: 32,
    CATEGORY_TOHAND: 8,
    CATEGORY_TOKEN: 1024,
    CHAININFO_CHAIN_COUNT: 1,
    CHAININFO_CHAIN_ID: 2048,
    CHAININFO_DISABLE_PLAYER: 1024,
    CHAININFO_DISABLE_REASON: 512,
    CHAININFO_EXTTYPE: 8192,
    CHAININFO_TARGET_CARDS: 64,
    CHAININFO_TARGET_PARAM: 256,
    CHAININFO_TARGET_PLAYER: 128,
    CHAININFO_TRIGGERING_ATTACK: 4194304,
    CHAININFO_TRIGGERING_ATTRIBUTE: 1048576,
    CHAININFO_TRIGGERING_CODE: 32768,
    CHAININFO_TRIGGERING_CODE2: 65536,
    CHAININFO_TRIGGERING_CONTROLER: 8,
    CHAININFO_TRIGGERING_DEFENSE: 8388608,
    CHAININFO_TRIGGERING_EFFECT: 2,
    CHAININFO_TRIGGERING_LEVEL: 262144,
    CHAININFO_TRIGGERING_LOCATION: 16,
    CHAININFO_TRIGGERING_PLAYER: 4,
    CHAININFO_TRIGGERING_POSITION: 16384,
    CHAININFO_TRIGGERING_RACE: 2097152,
    CHAININFO_TRIGGERING_RANK: 524288,
    CHAININFO_TRIGGERING_SEQUENCE: 32,
    CHAININFO_TYPE: 4096,
    CHINT_ATTRIBUTE: 4,
    CHINT_CARD: 2,
    CHINT_DESC: 6,
    CHINT_NUMBER: 5,
    CHINT_RACE: 3,
    CHINT_TURN: 1,
    COUNTER_NEED_ENABLE: 8192,
    COUNTER_WITHOUT_PERMIT: 4096,
    DUEL_ATTACK_FIRST_TURN: 2,
    DUEL_OBSOLETE_RULING: 8,
    DUEL_OLD_REPLAY: 4,
    DUEL_PSEUDO_SHUFFLE: 16,
    DUEL_RETURN_DECK_TOP: 128,
    DUEL_REVEAL_DECK_SEQ: 256,
    DUEL_SIMPLE_AI: 64,
    DUEL_TAG_MODE: 32,
    DUEL_TEST_MODE: 1,
    EFFECT_ACTIVATE_COST: 90,
    EFFECT_ACTIVATION_COUNT_LIMIT: 367,
    EFFECT_ADD_ATTRIBUTE: 125,
    EFFECT_ADD_CODE: 113,
    EFFECT_ADD_EXTRA_TRIBUTE: 157,
    EFFECT_ADD_FUSION_ATTRIBUTE: 349,
    EFFECT_ADD_FUSION_CODE: 340,
    EFFECT_ADD_FUSION_SETCODE: 341,
    EFFECT_ADD_LINK_ATTRIBUTE: 356,
    EFFECT_ADD_LINK_CODE: 354,
    EFFECT_ADD_LINK_RACE: 357,
    EFFECT_ADD_LINK_SETCODE: 355,
    EFFECT_ADD_RACE: 120,
    EFFECT_ADD_SETCODE: 334,
    EFFECT_ADD_TYPE: 115,
    EFFECT_ALSO_BATTLE_DAMAGE: 207,
    EFFECT_ATTACK_ALL: 193,
    EFFECT_ATTACK_COST: 96,
    EFFECT_ATTACK_DISABLED: 197,
    EFFECT_AVOID_BATTLE_DAMAGE: 201,
    EFFECT_BATTLE_DAMAGE_TO_EFFECT: 205,
    EFFECT_BATTLE_DESTROY_REDIRECT: 204,
    EFFECT_BOTH_BATTLE_DAMAGE: 206,
    EFFECT_BP_TWICE: 296,
    EFFECT_CANNOT_ACTIVATE: 6,
    EFFECT_CANNOT_ATTACK: 85,
    EFFECT_CANNOT_ATTACK_ANNOUNCE: 86,
    EFFECT_CANNOT_BE_BATTLE_TARGET: 70,
    EFFECT_CANNOT_BE_EFFECT_TARGET: 71,
    EFFECT_CANNOT_BP: 185,
    EFFECT_CANNOT_CHANGE_CONTROL: 5,
    EFFECT_CANNOT_CHANGE_POSITION: 14,
    EFFECT_CANNOT_CHANGE_POS_E: 87,
    EFFECT_CANNOT_DIRECT_ATTACK: 73,
    EFFECT_CANNOT_DISABLE: 3,
    EFFECT_CANNOT_DISABLE_FLIP_SUMMON: 39,
    EFFECT_CANNOT_DISABLE_SPSUMMON: 27,
    EFFECT_CANNOT_DISABLE_SUMMON: 26,
    EFFECT_CANNOT_DISCARD_DECK: 56,
    EFFECT_CANNOT_DISCARD_HAND: 55,
    EFFECT_CANNOT_DISEFFECT: 13,
    EFFECT_CANNOT_DRAW: 25,
    EFFECT_CANNOT_EP: 187,
    EFFECT_CANNOT_FLIP_SUMMON: 21,
    EFFECT_CANNOT_INACTIVATE: 12,
    EFFECT_CANNOT_M2: 186,
    EFFECT_CANNOT_MSET: 23,
    EFFECT_CANNOT_PLACE_COUNTER: 58,
    EFFECT_CANNOT_RELEASE: 46,
    EFFECT_CANNOT_REMOVE: 67,
    EFFECT_CANNOT_SELECT_BATTLE_TARGET: 332,
    EFFECT_CANNOT_SELECT_EFFECT_TARGET: 333,
    EFFECT_CANNOT_SPECIAL_SUMMON: 22,
    EFFECT_CANNOT_SSET: 24,
    EFFECT_CANNOT_SUMMON: 20,
    EFFECT_CANNOT_TO_DECK: 66,
    EFFECT_CANNOT_TO_GRAVE: 68,
    EFFECT_CANNOT_TO_GRAVE_AS_COST: 59,
    EFFECT_CANNOT_TO_HAND: 65,
    EFFECT_CANNOT_TRIGGER: 7,
    EFFECT_CANNOT_TURN_SET: 69,
    EFFECT_CANNOT_USE_AS_COST: 57,
    EFFECT_CHAIN_MATERIAL: 231,
    EFFECT_CHANGE_ATTRIBUTE: 127,
    EFFECT_CHANGE_BATTLE_DAMAGE: 208,
    EFFECT_CHANGE_CODE: 114,
    EFFECT_CHANGE_DAMAGE: 82,
    EFFECT_CHANGE_ENVIRONMENT: 290,
    EFFECT_CHANGE_FUSION_ATTRIBUTE: 351,
    EFFECT_CHANGE_GRAVE_ATTRIBUTE: 365,
    EFFECT_CHANGE_GRAVE_RACE: 366,
    EFFECT_CHANGE_INVOLVING_BATTLE_DAMAGE: 314,
    EFFECT_CHANGE_LEVEL: 131,
    EFFECT_CHANGE_LSCALE: 135,
    EFFECT_CHANGE_RACE: 122,
    EFFECT_CHANGE_RANK: 133,
    EFFECT_CHANGE_RANK_FINAL: 315,
    EFFECT_CHANGE_RSCALE: 137,
    EFFECT_CHANGE_TYPE: 117,
    EFFECT_COUNT_CODE_CHAIN: 1073741824,
    EFFECT_COUNT_CODE_DUEL: 536870912,
    EFFECT_COUNT_CODE_OATH: 268435456,
    EFFECT_COUNT_CODE_SINGLE: 1,
    EFFECT_DECREASE_TRIBUTE: 151,
    EFFECT_DECREASE_TRIBUTE_SET: 152,
    EFFECT_DEFENSE_ATTACK: 190,
    EFFECT_DESTROY_REPLACE: 50,
    EFFECT_DESTROY_SUBSTITUTE: 45,
    EFFECT_DIRECT_ATTACK: 74,
    EFFECT_DISABLE: 2,
    EFFECT_DISABLE_CHAIN: 9,
    EFFECT_DISABLE_CHAIN_FIELD: 337,
    EFFECT_DISABLE_EFFECT: 8,
    EFFECT_DISABLE_FIELD: 260,
    EFFECT_DISABLE_TRAPMONSTER: 10,
    EFFECT_DISCARD_COST_CHANGE: 338,
    EFFECT_DIVINE_LIGHT: 38,
    EFFECT_DOUBLE_TRIBUTE: 150,
    EFFECT_DOUBLE_XMATERIAL: 375,
    EFFECT_DRAW_COUNT: 271,
    EFFECT_DUAL_STATUS: 75,
    EFFECT_DUAL_SUMMONABLE: 77,
    EFFECT_EQUIP_LIMIT: 76,
    EFFECT_EXTRA_ATTACK: 194,
    EFFECT_EXTRA_ATTACK_MONSTER: 346,
    EFFECT_EXTRA_FUSION_MATERIAL: 352,
    EFFECT_EXTRA_LINK_MATERIAL: 358,
    EFFECT_EXTRA_PENDULUM_SUMMON: 360,
    EFFECT_EXTRA_RELEASE: 153,
    EFFECT_EXTRA_RELEASE_NONSUM: 158,
    EFFECT_EXTRA_RELEASE_SUM: 155,
    EFFECT_EXTRA_SET_COUNT: 35,
    EFFECT_EXTRA_SUMMON_COUNT: 29,
    EFFECT_EXTRA_SYNCHRO_MATERIAL: 232,
    EFFECT_FIRST_ATTACK: 192,
    EFFECT_FLAG2_COF: 2,
    EFFECT_FLAG2_OPTION: 8,
    EFFECT_FLAG2_REPEAT_UPDATE: 1,
    EFFECT_FLAG2_WICKED: 4,
    EFFECT_FLAG_ABSOLUTE_TARGET: 64,
    EFFECT_FLAG_ACTIVATE_CONDITION: 536870912,
    EFFECT_FLAG_BOTH_SIDE: 4096,
    EFFECT_FLAG_CANNOT_DISABLE: 1024,
    EFFECT_FLAG_CANNOT_INACTIVATE: 33554432,
    EFFECT_FLAG_CAN_FORBIDDEN: 512,
    EFFECT_FLAG_CARD_TARGET: 16,
    EFFECT_FLAG_CLIENT_HINT: 67108864,
    EFFECT_FLAG_COIN: 4294967296,
    EFFECT_FLAG_CONTINUOUS_TARGET: 134217728,
    EFFECT_FLAG_COPY: 8192,
    EFFECT_FLAG_COUNT_LIMIT: 4,
    EFFECT_FLAG_CVAL_CHECK: 1073741824,
    EFFECT_FLAG_DAMAGE_CAL: 32768,
    EFFECT_FLAG_DAMAGE_STEP: 16384,
    EFFECT_FLAG_DELAY: 65536,
    EFFECT_FLAG_DICE: 8589934592,
    EFFECT_FLAG_EFFECT: 536870912,
    EFFECT_FLAG_EVENT_PLAYER: 8388608,
    EFFECT_FLAG_FIELD_ONLY: 8,
    EFFECT_FLAG_FUNC_VALUE: 2,
    EFFECT_FLAG_FUSION_SUMMON: 17179869184,
    EFFECT_FLAG_IGNORE_IMMUNE: 128,
    EFFECT_FLAG_IGNORE_RANGE: 32,
    EFFECT_FLAG_IMMEDIATELY_APPLY: 2147483648,
    EFFECT_FLAG_INITIAL: 1,
    EFFECT_FLAG_LIMIT_ZONE: 268435456,
    EFFECT_FLAG_NO_TURN_RESET: 4194304,
    EFFECT_FLAG_OATH: 524288,
    EFFECT_FLAG_OWNER_RELATE: 16777216,
    EFFECT_FLAG_PLAYER_TARGET: 2048,
    EFFECT_FLAG_REPEAT: 2097152,
    EFFECT_FLAG_SET_AVAILABLE: 256,
    EFFECT_FLAG_SINGLE_RANGE: 131072,
    EFFECT_FLAG_SPSUM_PARAM: 1048576,
    EFFECT_FLAG_UNCOPYABLE: 262144,
    EFFECT_FLIPSUMMON_COST: 93,
    EFFECT_FORBIDDEN: 292,
    EFFECT_FUSION_MATERIAL: 230,
    EFFECT_FUSION_SUBSTITUTE: 234,
    EFFECT_HAND_LIMIT: 270,
    EFFECT_HAND_SYNCHRO: 339,
    EFFECT_IGNORE_BATTLE_TARGET: 72,
    EFFECT_IMMUNE_EFFECT: 1,
    EFFECT_INDESTRUCTABLE: 40,
    EFFECT_INDESTRUCTABLE_BATTLE: 42,
    EFFECT_INDESTRUCTABLE_COUNT: 47,
    EFFECT_INDESTRUCTABLE_EFFECT: 41,
    EFFECT_KAISER_COLOSSEUM: 370,
    EFFECT_LEAVE_FIELD_REDIRECT: 60,
    EFFECT_LEFT_SPSUMMON_COUNT: 331,
    EFFECT_LIMIT_SET_PROC: 37,
    EFFECT_LIMIT_SPECIAL_SUMMON_POSITION: 368,
    EFFECT_LIMIT_SUMMON_PROC: 33,
    EFFECT_LPCOST_CHANGE: 170,
    EFFECT_LPCOST_REPLACE: 171,
    EFFECT_MATCH_KILL: 300,
    EFFECT_MATERIAL_CHECK: 251,
    EFFECT_MATERIAL_LIMIT: 361,
    EFFECT_MAX_MZONE: 263,
    EFFECT_MAX_SZONE: 264,
    EFFECT_MONSTER_SSET: 18,
    EFFECT_MSET_COST: 94,
    EFFECT_MUST_ATTACK: 191,
    EFFECT_MUST_ATTACK_MONSTER: 344,
    EFFECT_MUST_BE_ATTACKED: 195,
    EFFECT_MUST_BE_FMATERIAL: 316,
    EFFECT_MUST_BE_LMATERIAL: 318,
    EFFECT_MUST_BE_SMATERIAL: 312,
    EFFECT_MUST_BE_XMATERIAL: 317,
    EFFECT_MUST_USE_MZONE: 265,
    EFFECT_NECRO_VALLEY: 291,
    EFFECT_NECRO_VALLEY_IM: 293,
    EFFECT_NO_BATTLE_DAMAGE: 200,
    EFFECT_NO_EFFECT_DAMAGE: 335,
    EFFECT_OLDUNION_STATUS: 348,
    EFFECT_ONLY_ATTACK_MONSTER: 343,
    EFFECT_ONLY_BE_ATTACKED: 196,
    EFFECT_OVERLAY_RITUAL_MATERIAL: 364,
    EFFECT_PATRICIAN_OF_DARKNESS: 345,
    EFFECT_PIERCE: 203,
    EFFECT_PRE_MONSTER: 250,
    EFFECT_PUBLIC: 160,
    EFFECT_QP_ACT_IN_NTPHAND: 311,
    EFFECT_QP_ACT_IN_SET_TURN: 359,
    EFFECT_REFLECT_BATTLE_DAMAGE: 202,
    EFFECT_REFLECT_DAMAGE: 83,
    EFFECT_RELEASE_REPLACE: 51,
    EFFECT_REMAIN_FIELD: 17,
    EFFECT_REMOVE_ATTRIBUTE: 126,
    EFFECT_REMOVE_BRAINWASHING: 295,
    EFFECT_REMOVE_FUSION_ATTRIBUTE: 350,
    EFFECT_REMOVE_RACE: 121,
    EFFECT_REMOVE_REDIRECT: 64,
    EFFECT_REMOVE_TYPE: 116,
    EFFECT_REPLACE_DAMAGE: 371,
    EFFECT_REVERSE_DAMAGE: 80,
    EFFECT_REVERSE_DECK: 294,
    EFFECT_REVERSE_RECOVER: 81,
    EFFECT_REVERSE_UPDATE: 108,
    EFFECT_REVIVE_LIMIT: 31,
    EFFECT_RISE_TO_FULL_HEIGHT: 342,
    EFFECT_RITUAL_LEVEL_EX: 374,
    EFFECT_SELF_DESTROY: 141,
    EFFECT_SELF_TOGRAVE: 142,
    EFFECT_SEND_REPLACE: 52,
    EFFECT_SET_ATTACK: 101,
    EFFECT_SET_ATTACK_FINAL: 102,
    EFFECT_SET_BASE_ATTACK: 103,
    EFFECT_SET_BASE_ATTACK_FINAL: 111,
    EFFECT_SET_BASE_DEFENSE: 107,
    EFFECT_SET_BASE_DEFENSE_FINAL: 112,
    EFFECT_SET_BATTLE_ATTACK: 362,
    EFFECT_SET_BATTLE_DEFENSE: 363,
    EFFECT_SET_CONTROL: 4,
    EFFECT_SET_DEFENSE: 105,
    EFFECT_SET_DEFENSE_FINAL: 106,
    EFFECT_SET_POSITION: 140,
    EFFECT_SET_PROC: 36,
    EFFECT_SET_SUMMON_COUNT_LIMIT: 28,
    EFFECT_SKIP_BP: 183,
    EFFECT_SKIP_DP: 180,
    EFFECT_SKIP_M1: 182,
    EFFECT_SKIP_M2: 184,
    EFFECT_SKIP_SP: 181,
    EFFECT_SKIP_TURN: 188,
    EFFECT_SPIRIT_DONOT_RETURN: 280,
    EFFECT_SPIRIT_MAYNOT_RETURN: 281,
    EFFECT_SPSUMMON_CONDITION: 30,
    EFFECT_SPSUMMON_COST: 92,
    EFFECT_SPSUMMON_COUNT_LIMIT: 330,
    EFFECT_SPSUMMON_PROC: 34,
    EFFECT_SPSUMMON_PROC_G: 320,
    EFFECT_SSET_COST: 95,
    EFFECT_SUMMON_COST: 91,
    EFFECT_SUMMON_PROC: 32,
    EFFECT_SWAP_AD: 109,
    EFFECT_SWAP_BASE_AD: 110,
    EFFECT_SYNCHRO_CHECK: 310,
    EFFECT_SYNCHRO_LEVEL_EX: 373,
    EFFECT_TOSS_COIN_REPLACE: 220,
    EFFECT_TOSS_DICE_REPLACE: 221,
    EFFECT_TO_DECK_REDIRECT: 62,
    EFFECT_TO_GRAVE_REDIRECT: 63,
    EFFECT_TO_GRAVE_REDIRECT_CB: 313,
    EFFECT_TO_HAND_REDIRECT: 61,
    EFFECT_TRAP_ACT_IN_HAND: 15,
    EFFECT_TRAP_ACT_IN_SET_TURN: 16,
    EFFECT_TRIBUTE_LIMIT: 154,
    EFFECT_TRIPLE_TRIBUTE: 156,
    EFFECT_TUNER: 369,
    EFFECT_TUNER_MATERIAL_LIMIT: 353,
    EFFECT_TYPE_ACTIONS: 8,
    EFFECT_TYPE_ACTIVATE: 16,
    EFFECT_TYPE_CONTINUOUS: 2048,
    EFFECT_TYPE_EQUIP: 4,
    EFFECT_TYPE_FIELD: 2,
    EFFECT_TYPE_FLIP: 32,
    EFFECT_TYPE_GRANT: 8192,
    EFFECT_TYPE_IGNITION: 64,
    EFFECT_TYPE_QUICK_F: 1024,
    EFFECT_TYPE_QUICK_O: 256,
    EFFECT_TYPE_SINGLE: 1,
    EFFECT_TYPE_TARGET: 16384,
    EFFECT_TYPE_TRIGGER_F: 512,
    EFFECT_TYPE_TRIGGER_O: 128,
    EFFECT_TYPE_XMATERIAL: 4096,
    EFFECT_UNION_LIMIT: 78,
    EFFECT_UNION_STATUS: 347,
    EFFECT_UNIQUE_CHECK: 297,
    EFFECT_UNRELEASABLE_EFFECT: 48,
    EFFECT_UNRELEASABLE_NONSUM: 44,
    EFFECT_UNRELEASABLE_SUM: 43,
    EFFECT_UNSUMMONABLE_CARD: 336,
    EFFECT_UPDATE_ATTACK: 100,
    EFFECT_UPDATE_DEFENSE: 104,
    EFFECT_UPDATE_LEVEL: 130,
    EFFECT_UPDATE_LSCALE: 134,
    EFFECT_UPDATE_RANK: 132,
    EFFECT_UPDATE_RSCALE: 136,
    EFFECT_USE_EXTRA_MZONE: 261,
    EFFECT_USE_EXTRA_SZONE: 262,
    EFFECT_XYZ_MATERIAL: 233,
    EFFECT_XYZ_MIN_COUNT: 372,
    EVENT_ADD_COUNTER: 65536,
    EVENT_ADJUST: 1040,
    EVENT_ATTACK_ANNOUNCE: 1130,
    EVENT_ATTACK_DISABLED: 1142,
    EVENT_BATTLED: 1138,
    EVENT_BATTLE_CONFIRM: 1133,
    EVENT_BATTLE_DAMAGE: 1143,
    EVENT_BATTLE_DESTROYED: 1140,
    EVENT_BATTLE_DESTROYING: 1139,
    EVENT_BATTLE_END: 1137,
    EVENT_BATTLE_START: 1132,
    EVENT_BECOME_TARGET: 1028,
    EVENT_BE_BATTLE_TARGET: 1131,
    EVENT_BE_MATERIAL: 1108,
    EVENT_BE_PRE_MATERIAL: 1109,
    EVENT_BREAK_EFFECT: 1050,
    EVENT_CHAINING: 1027,
    EVENT_CHAIN_ACTIVATED: 1023,
    EVENT_CHAIN_ACTIVATING: 1021,
    EVENT_CHAIN_DISABLED: 1025,
    EVENT_CHAIN_END: 1026,
    EVENT_CHAIN_NEGATED: 1024,
    EVENT_CHAIN_SOLVED: 1022,
    EVENT_CHAIN_SOLVING: 1020,
    EVENT_CHANGE_POS: 1016,
    EVENT_CONTROL_CHANGED: 1120,
    EVENT_CUSTOM: 268435456,
    EVENT_DAMAGE: 1111,
    EVENT_DAMAGE_CALCULATING: 1135,
    EVENT_DAMAGE_STEP_END: 1141,
    EVENT_DESTROY: 1010,
    EVENT_DESTROYED: 1029,
    EVENT_DETACH_MATERIAL: 1202,
    EVENT_DISCARD: 1018,
    EVENT_DRAW: 1110,
    EVENT_EQUIP: 1121,
    EVENT_FLIP: 1001,
    EVENT_FLIP_SUMMON: 1104,
    EVENT_FLIP_SUMMON_NEGATED: 1115,
    EVENT_FLIP_SUMMON_SUCCESS: 1101,
    EVENT_FREE_CHAIN: 1002,
    EVENT_LEAVE_DECK: 1032,
    EVENT_LEAVE_FIELD: 1015,
    EVENT_LEAVE_FIELD_P: 1019,
    EVENT_LEAVE_GRAVE: 1031,
    EVENT_LEVEL_UP: 1200,
    EVENT_MOVE: 1030,
    EVENT_MSET: 1106,
    EVENT_PAY_LPCOST: 1201,
    EVENT_PHASE: 4096,
    EVENT_PHASE_START: 8192,
    EVENT_PREDRAW: 1113,
    EVENT_PRE_BATTLE_DAMAGE: 1136,
    EVENT_PRE_DAMAGE_CALCULATE: 1134,
    EVENT_RECOVER: 1112,
    EVENT_RELEASE: 1017,
    EVENT_REMOVE: 1011,
    EVENT_REMOVE_COUNTER: 131072,
    EVENT_RETURN_TO_GRAVE: 1203,
    EVENT_SPSUMMON: 1105,
    EVENT_SPSUMMON_NEGATED: 1116,
    EVENT_SPSUMMON_SUCCESS: 1102,
    EVENT_SPSUMMON_SUCCESS_G_P: 1117,
    EVENT_SSET: 1107,
    EVENT_STARTUP: 1e3,
    EVENT_SUMMON: 1103,
    EVENT_SUMMON_NEGATED: 1114,
    EVENT_SUMMON_SUCCESS: 1100,
    EVENT_TOSS_COIN: 1151,
    EVENT_TOSS_COIN_NEGATE: 1152,
    EVENT_TOSS_DICE: 1150,
    EVENT_TOSS_DICE_NEGATE: 1153,
    EVENT_TO_DECK: 1013,
    EVENT_TO_GRAVE: 1014,
    EVENT_TO_HAND: 1012,
    EVENT_TURN_END: 1210,
    FLAG_ID_ALLURE_QUEEN: 4,
    FLAG_ID_ARCANA_COIN: 5,
    FLAG_ID_CHAINING: 1,
    FLAG_ID_NO_NORMAL_DRAW: 3,
    FLAG_ID_REVERSAL_OF_FATE: 36690018,
    FLAG_ID_UNION: 2,
    GLOBALFLAG_BRAINWASHING_CHECK: 2,
    GLOBALFLAG_DECK_REVERSE_CHECK: 1,
    GLOBALFLAG_DELAYED_QUICKEFFECT: 8,
    GLOBALFLAG_DETACH_EVENT: 16,
    GLOBALFLAG_MUST_BE_SMATERIAL: 32,
    GLOBALFLAG_SCRAP_CHIMERA: 4,
    GLOBALFLAG_SELF_TOGRAVE: 256,
    GLOBALFLAG_SPSUMMON_COUNT: 64,
    GLOBALFLAG_SPSUMMON_ONCE: 512,
    GLOBALFLAG_TUNE_MAGICIAN: 1024,
    GLOBALFLAG_XMAT_COUNT_LIMIT: 128,
    HINGMSG_LVRANK: 567,
    HINGMSG_NUMBER: 565,
    HINTMSG_ATOHAND: 506,
    HINTMSG_ATTACK: 516,
    HINTMSG_ATTACKTARGET: 549,
    HINTMSG_ATTRIBUTE: 562,
    HINTMSG_CARDTYPE: 554,
    HINTMSG_CODE: 564,
    HINTMSG_COIN: 552,
    HINTMSG_CONFIRM: 526,
    HINTMSG_CONTROL: 520,
    HINTMSG_COUNTER: 572,
    HINTMSG_DEATTACHFROM: 532,
    HINTMSG_DEFENSE: 517,
    HINTMSG_DESREPLACE: 521,
    HINTMSG_DESTROY: 502,
    HINTMSG_DICE: 553,
    HINTMSG_DISABLE: 573,
    HINTMSG_DISABLEZONE: 570,
    HINTMSG_DISCARD: 501,
    HINTMSG_EFFECT: 550,
    HINTMSG_EQUIP: 518,
    HINTMSG_FACEDOWN: 515,
    HINTMSG_FACEDOWNATTACK: 524,
    HINTMSG_FACEDOWNDEFENSE: 525,
    HINTMSG_FACEUP: 514,
    HINTMSG_FACEUPATTACK: 522,
    HINTMSG_FACEUPDEFENSE: 523,
    HINTMSG_FIELD_FIRST: 575,
    HINTMSG_FMATERIAL: 511,
    HINTMSG_LMATERIAL: 533,
    HINTMSG_OPERATECARD: 574,
    HINTMSG_OPPO: 530,
    HINTMSG_OPTION: 555,
    HINTMSG_POSCHANGE: 528,
    HINTMSG_POSITION: 561,
    HINTMSG_RACE: 563,
    HINTMSG_RELEASE: 500,
    HINTMSG_REMOVE: 503,
    HINTMSG_REMOVEXYZ: 519,
    HINTMSG_RESOLVECARD: 568,
    HINTMSG_RESOLVEEFFECT: 556,
    HINTMSG_RTOHAND: 505,
    HINTMSG_SELECT: 560,
    HINTMSG_SELF: 529,
    HINTMSG_SET: 510,
    HINTMSG_SMATERIAL: 512,
    HINTMSG_SPSUMMON: 509,
    HINTMSG_SUMMON: 508,
    HINTMSG_TARGET: 551,
    HINTMSG_TODECK: 507,
    HINTMSG_TOFIELD: 527,
    HINTMSG_TOGRAVE: 504,
    HINTMSG_TOZONE: 571,
    HINTMSG_TRIBUTE: 531,
    HINTMSG_XMATERIAL: 513,
    HINTMSG_ZONE: 569,
    HINT_ATTRIB: 7,
    HINT_CARD: 10,
    HINT_CODE: 8,
    HINT_EFFECT: 5,
    HINT_EVENT: 1,
    HINT_MESSAGE: 2,
    HINT_NUMBER: 9,
    HINT_OPSELECTED: 4,
    HINT_RACE: 6,
    HINT_SELECTMSG: 3,
    HINT_ZONE: 11,
    LINK_MARKER_BOTTOM: 2,
    LINK_MARKER_BOTTOM_LEFT: 1,
    LINK_MARKER_BOTTOM_RIGHT: 4,
    LINK_MARKER_LEFT: 8,
    LINK_MARKER_RIGHT: 32,
    LINK_MARKER_TOP: 128,
    LINK_MARKER_TOP_LEFT: 64,
    LINK_MARKER_TOP_RIGHT: 256,
    LOCATION_DECK: 1,
    LOCATION_DECKBOT: 65537,
    LOCATION_DECKSHF: 131073,
    LOCATION_EXTRA: 64,
    LOCATION_FZONE: 256,
    LOCATION_GRAVE: 16,
    LOCATION_HAND: 2,
    LOCATION_MZONE: 4,
    LOCATION_ONFIELD: 12,
    LOCATION_OVERLAY: 128,
    LOCATION_PZONE: 512,
    LOCATION_REASON_CONTROL: 2,
    LOCATION_REASON_TOFIELD: 1,
    LOCATION_REMOVED: 32,
    LOCATION_SZONE: 8,
    MASTER_RULE3: 3,
    MASTER_RULE_2020: 5,
    MAX_COUNTER: 65535,
    MAX_ID: 268435455,
    MAX_PARAMETER: 65535,
    MAX_XYZ_LEVEL: 4095,
    MIN_ID: 128,
    NEW_MASTER_RULE: 4,
    OPCODE_ADD: 1073741824,
    OPCODE_AND: 1073741828,
    OPCODE_DIV: 1073741827,
    OPCODE_ISATTRIBUTE: 1073742084,
    OPCODE_ISCODE: 1073742080,
    OPCODE_ISRACE: 1073742083,
    OPCODE_ISSETCARD: 1073742081,
    OPCODE_ISTYPE: 1073742082,
    OPCODE_MUL: 1073741826,
    OPCODE_NEG: 1073741830,
    OPCODE_NOT: 1073741831,
    OPCODE_OR: 1073741829,
    OPCODE_SUB: 1073741825,
    PHASE_BATTLE: 128,
    PHASE_BATTLE_START: 8,
    PHASE_BATTLE_STEP: 16,
    PHASE_DAMAGE: 32,
    PHASE_DAMAGE_CAL: 64,
    PHASE_DRAW: 1,
    PHASE_END: 512,
    PHASE_MAIN1: 4,
    PHASE_MAIN2: 256,
    PHASE_STANDBY: 2,
    PLAYER_ALL: 3,
    PLAYER_NONE: 2,
    POS_ATTACK: 3,
    POS_DEFENSE: 12,
    POS_FACEDOWN: 10,
    POS_FACEDOWN_ATTACK: 2,
    POS_FACEDOWN_DEFENSE: 8,
    POS_FACEUP: 5,
    POS_FACEUP_ATTACK: 1,
    POS_FACEUP_DEFENSE: 4,
    RACE_ALL: 67108863,
    RACE_AQUA: 64,
    RACE_BEAST: 16384,
    RACE_BEASTWARRIOR: 32768,
    RACE_CREATORGOD: 4194304,
    RACE_CYBERSE: 16777216,
    RACE_DINOSAUR: 65536,
    RACE_DIVINE: 2097152,
    RACE_DRAGON: 8192,
    RACE_FAIRY: 4,
    RACE_FIEND: 8,
    RACE_FISH: 131072,
    RACE_ILLUSION: 33554432,
    RACE_INSECT: 2048,
    RACE_MACHINE: 32,
    RACE_PLANT: 1024,
    RACE_PSYCHO: 1048576,
    RACE_PYRO: 128,
    RACE_REPTILE: 524288,
    RACE_ROCK: 256,
    RACE_SEASERPENT: 262144,
    RACE_SPELLCASTER: 2,
    RACE_THUNDER: 4096,
    RACE_WARRIOR: 1,
    RACE_WINDBEAST: 512,
    RACE_WYRM: 8388608,
    RACE_ZOMBIE: 16,
    REASON_ACTION: 2147483648,
    REASON_ADJUST: 256,
    REASON_BATTLE: 32,
    REASON_COST: 128,
    REASON_DESTROY: 1,
    REASON_DISCARD: 16384,
    REASON_DISSUMMON: 4096,
    REASON_DRAW: 33554432,
    REASON_EFFECT: 64,
    REASON_FLIP: 8192,
    REASON_FUSION: 262144,
    REASON_LINK: 268435456,
    REASON_LOST_OVERLAY: 536870912,
    REASON_LOST_TARGET: 512,
    REASON_MAINTENANCE: 1073741824,
    REASON_MATERIAL: 8,
    REASON_RDAMAGE: 32768,
    REASON_REDIRECT: 67108864,
    REASON_RELEASE: 2,
    REASON_REPLACE: 16777216,
    REASON_RETURN: 131072,
    REASON_REVEAL: 134217728,
    REASON_RITUAL: 1048576,
    REASON_RRECOVER: 65536,
    REASON_RULE: 1024,
    REASON_SPSUMMON: 2048,
    REASON_SUMMON: 16,
    REASON_SYNCHRO: 524288,
    REASON_TEMPORARY: 4,
    REASON_XYZ: 2097152,
    RESETS_REDIRECT: 209584128,
    RESETS_STANDARD: 33423360,
    RESETS_WITHOUT_TEMP_REMOVE: 91095040,
    RESET_CARD: 8192,
    RESET_CHAIN: 2147483648,
    RESET_CODE: 16384,
    RESET_CONTROL: 33554432,
    RESET_COPY: 32768,
    RESET_DISABLE: 65536,
    RESET_EVENT: 4096,
    RESET_LEAVE: 8388608,
    RESET_MSCHANGE: 134217728,
    RESET_OPPO_TURN: 536870912,
    RESET_OVERLAY: 67108864,
    RESET_PHASE: 1073741824,
    RESET_REMOVE: 524288,
    RESET_SELF_TURN: 268435456,
    RESET_TEMP_REMOVE: 1048576,
    RESET_TODECK: 4194304,
    RESET_TOFIELD: 16777216,
    RESET_TOGRAVE: 262144,
    RESET_TOHAND: 2097152,
    RESET_TURN_SET: 131072,
    SELECT_HEADS: 60,
    SELECT_TAILS: 61,
    SEQ_DECKBOTTOM: 1,
    SEQ_DECKSHUFFLE: 2,
    SEQ_DECKTOP: 0,
    STATUS_ACTIVATE_DISABLED: 262144,
    STATUS_ACT_FROM_HAND: 134217728,
    STATUS_ATTACK_CANCELED: 2097152,
    STATUS_BATTLE_DESTROYED: 16384,
    STATUS_BATTLE_RESULT: 64,
    STATUS_CANNOT_CHANGE_FORM: 256,
    STATUS_CHAINING: 65536,
    STATUS_CONTINUOUS_POS: 33554432,
    STATUS_COPYING_EFFECT: 32768,
    STATUS_DESTROY_CONFIRMED: 4096,
    STATUS_DISABLED: 1,
    STATUS_EFFECT_ENABLED: 1024,
    STATUS_EFFECT_REPLACED: 524288,
    STATUS_FLIP_SUMMONING: 1048576,
    STATUS_FLIP_SUMMON_DISABLED: 2147483648,
    STATUS_FLIP_SUMMON_TURN: 536870912,
    STATUS_FORBIDDEN: 67108864,
    STATUS_INITIALIZING: 4194304,
    STATUS_JUST_POS: 16777216,
    STATUS_LEAVE_CONFIRMED: 8192,
    STATUS_NO_LEVEL: 32,
    STATUS_OPPO_BATTLE: 268435456,
    STATUS_PROC_COMPLETE: 8,
    STATUS_SET_TURN: 16,
    STATUS_SPSUMMON_STEP: 128,
    STATUS_SPSUMMON_TURN: 1073741824,
    STATUS_SUMMONING: 512,
    STATUS_SUMMON_DISABLED: 131072,
    STATUS_SUMMON_TURN: 2048,
    STATUS_TO_DISABLE: 4,
    STATUS_TO_ENABLE: 2,
    STATUS_TO_HAND_WITHOUT_CONFIRM: 8388608,
    SUMMON_INFO_ATTACK: 128,
    SUMMON_INFO_ATTRIBUTE: 32,
    SUMMON_INFO_CODE: 1,
    SUMMON_INFO_CODE2: 2,
    SUMMON_INFO_DEFENSE: 256,
    SUMMON_INFO_LEVEL: 8,
    SUMMON_INFO_RACE: 64,
    SUMMON_INFO_RANK: 16,
    SUMMON_INFO_REASON_EFFECT: 512,
    SUMMON_INFO_REASON_PLAYER: 1024,
    SUMMON_INFO_TYPE: 4,
    SUMMON_TYPE_ADVANCE: 285212672,
    SUMMON_TYPE_DUAL: 301989888,
    SUMMON_TYPE_FLIP: 536870912,
    SUMMON_TYPE_FUSION: 1124073472,
    SUMMON_TYPE_LINK: 1275068416,
    SUMMON_TYPE_NORMAL: 268435456,
    SUMMON_TYPE_PENDULUM: 1241513984,
    SUMMON_TYPE_RITUAL: 1157627904,
    SUMMON_TYPE_SPECIAL: 1073741824,
    SUMMON_TYPE_SYNCHRO: 1174405120,
    SUMMON_TYPE_XYZ: 1224736768,
    SUMMON_VALUE_ASSAULT_MODE: 21,
    SUMMON_VALUE_DARK_FUSION: 1124073494,
    SUMMON_VALUE_DARK_SANCTUARY: 18,
    SUMMON_VALUE_EVOLTILE: 16384,
    SUMMON_VALUE_FOSSIL_FUSION: 1124073495,
    SUMMON_VALUE_FUTURE_FUSION: 1124073496,
    SUMMON_VALUE_GLADIATOR: 8192,
    SUMMON_VALUE_LV: 4096,
    SUMMON_VALUE_MASK_CHANGE: 20,
    SUMMON_VALUE_MONSTER_REBORN: 19,
    SUMMON_VALUE_SELF: 1,
    SUMMON_VALUE_SYNCHRO_MATERIAL: 17,
    TIMINGS_CHECK_MONSTER: 448,
    TIMING_ATTACK: 4096,
    TIMING_BATTLED: 134217728,
    TIMING_BATTLE_END: 16,
    TIMING_BATTLE_PHASE: 16777216,
    TIMING_BATTLE_START: 8,
    TIMING_BATTLE_STEP_END: 67108864,
    TIMING_CHAIN_END: 32768,
    TIMING_DAMAGE: 131072,
    TIMING_DAMAGE_CAL: 16384,
    TIMING_DAMAGE_STEP: 8192,
    TIMING_DESTROY: 524288,
    TIMING_DRAW: 65536,
    TIMING_DRAW_PHASE: 1,
    TIMING_END_PHASE: 32,
    TIMING_EQUIP: 33554432,
    TIMING_FLIPSUMMON: 256,
    TIMING_MAIN_END: 4,
    TIMING_MSET: 512,
    TIMING_POS_CHANGE: 2048,
    TIMING_RECOVER: 262144,
    TIMING_REMOVE: 1048576,
    TIMING_SPSUMMON: 128,
    TIMING_SSET: 1024,
    TIMING_STANDBY_PHASE: 2,
    TIMING_SUMMON: 64,
    TIMING_TODECK: 4194304,
    TIMING_TOGRAVE: 8388608,
    TIMING_TOHAND: 2097152,
    TYPES_EFFECT_TRAP_MONSTER: 289,
    TYPES_NORMAL_TRAP_MONSTER: 273,
    TYPES_TOKEN_MONSTER: 16401,
    TYPE_CONTINUOUS: 131072,
    TYPE_COUNTER: 1048576,
    TYPE_DUAL: 2048,
    TYPE_EFFECT: 32,
    TYPE_EQUIP: 262144,
    TYPE_FIELD: 524288,
    TYPE_FLIP: 2097152,
    TYPE_FUSION: 64,
    TYPE_LINK: 67108864,
    TYPE_MONSTER: 1,
    TYPE_NORMAL: 16,
    TYPE_PENDULUM: 16777216,
    TYPE_QUICKPLAY: 65536,
    TYPE_RITUAL: 128,
    TYPE_SPELL: 2,
    TYPE_SPIRIT: 512,
    TYPE_SPSUMMON: 33554432,
    TYPE_SYNCHRO: 8192,
    TYPE_TOKEN: 16384,
    TYPE_TOON: 4194304,
    TYPE_TRAP: 4,
    TYPE_TRAPMONSTER: 256,
    TYPE_TUNER: 4096,
    TYPE_UNION: 1024,
    TYPE_XYZ: 8388608
  };
  var YGOProMsgChainEnd = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChainEnd");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAIN_END;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  var YGOProMsgChainNegated = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChainNegated");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAIN_NEGATED;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgChainNegated.prototype, "chainCount", 2);
  var YGOProMsgChainSolved = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChainSolved");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAIN_SOLVED;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgChainSolved.prototype, "chainCount", 2);
  var YGOProMsgChainSolving = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChainSolving");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAIN_SOLVING;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgChainSolving.prototype, "chainCount", 2);
  var YGOProMsgChained = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChained");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAINED;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgChained.prototype, "chainCount", 2);
  var YGOProMsgChaining_CardLocation = class {
    static {
      __name(this, "YGOProMsgChaining_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgChaining_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgChaining_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgChaining_CardLocation.prototype, "sequence", 2);
  var YGOProMsgChaining = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgChaining");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CHAINING;
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgChaining.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgChaining.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgChaining.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgChaining.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgChaining.prototype, "subsequence", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgChaining_CardLocation, 8)
  ], YGOProMsgChaining.prototype, "chainCardLocation", 2);
  __decorateClass([
    BinaryField("i32", 11)
  ], YGOProMsgChaining.prototype, "desc", 2);
  __decorateClass([
    BinaryField("u8", 15)
  ], YGOProMsgChaining.prototype, "chainCount", 2);
  var YGOProMsgConfirmCards_CardInfo = class {
    static {
      __name(this, "YGOProMsgConfirmCards_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgConfirmCards_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgConfirmCards_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgConfirmCards_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgConfirmCards_CardInfo.prototype, "sequence", 2);
  var YGOProMsgConfirmCards = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgConfirmCards");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CONFIRM_CARDS;
    }
    getSendTargets() {
      if (this.cards.length > 0 && this.cards[0].location === 1) {
        return [this.player];
      }
      return SEND_TO_ALL;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgConfirmCards.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgConfirmCards.prototype, "skipPanel", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgConfirmCards.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgConfirmCards_CardInfo, 3, (obj) => obj.count)
  ], YGOProMsgConfirmCards.prototype, "cards", 2);
  var YGOProMsgConfirmDeckTop_CardInfo = class {
    static {
      __name(this, "YGOProMsgConfirmDeckTop_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgConfirmDeckTop_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgConfirmDeckTop_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgConfirmDeckTop_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgConfirmDeckTop_CardInfo.prototype, "sequence", 2);
  var YGOProMsgConfirmDeckTop = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgConfirmDeckTop");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CONFIRM_DECKTOP;
    }
    // MSG_CONFIRM_DECKTOP 在 single_duel.cpp 中不做遮掩，直接发给所有人
    // ocgcore 通过 0x80000000 标记控制公开状态
    // 因此使用基类的默认实现（不遮掩）
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgConfirmDeckTop.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgConfirmDeckTop.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgConfirmDeckTop_CardInfo, 2, (obj) => obj.count)
  ], YGOProMsgConfirmDeckTop.prototype, "cards", 2);
  var YGOProMsgConfirmExtraTop_CardInfo = class {
    static {
      __name(this, "YGOProMsgConfirmExtraTop_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgConfirmExtraTop_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgConfirmExtraTop_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgConfirmExtraTop_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgConfirmExtraTop_CardInfo.prototype, "sequence", 2);
  var YGOProMsgConfirmExtraTop = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgConfirmExtraTop");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_CONFIRM_EXTRATOP;
    }
    // MSG_CONFIRM_EXTRATOP 在 single_duel.cpp 中不做遮掩，直接发给所有人
    // ocgcore 通过 0x80000000 标记控制公开状态
    // 因此使用基类的默认实现（不遮掩）
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgConfirmExtraTop.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgConfirmExtraTop.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgConfirmExtraTop_CardInfo, 2, (obj) => obj.count)
  ], YGOProMsgConfirmExtraTop.prototype, "cards", 2);
  var YGOProMsgDamage = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgDamage");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_DAMAGE;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgDamage.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgDamage.prototype, "value", 2);
  var YGOProMsgDamageStepEnd = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgDamageStepEnd");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_DAMAGE_STEP_END;
    }
    getRequireRefreshZones() {
      return [
        { player: 0, location: OcgcoreScriptConstants.LOCATION_MZONE },
        { player: 1, location: OcgcoreScriptConstants.LOCATION_MZONE }
      ];
    }
  };
  var YGOProMsgDamageStepStart = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgDamageStepStart");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_DAMAGE_STEP_START;
    }
    getRequireRefreshZones() {
      return [
        { player: 0, location: OcgcoreScriptConstants.LOCATION_MZONE },
        { player: 1, location: OcgcoreScriptConstants.LOCATION_MZONE }
      ];
    }
  };
  var YGOProMsgDeckTop = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgDeckTop");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_DECK_TOP;
    }
    // MSG_DECK_TOP 在 single_duel.cpp 中不做遮掩，直接发给所有人
    // ocgcore 通过 0x80000000 标记控制公开状态
    // 因此使用基类的默认实现（不遮掩）
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgDeckTop.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgDeckTop.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("i32", 2)
  ], YGOProMsgDeckTop.prototype, "code", 2);
  var YGOProMsgDraw = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgDraw");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_DRAW;
    }
    // 对方视角需要隐藏抽到的卡（如果卡片标志位 0x80 未设置）
    opponentView() {
      const view = this.copy();
      view.cards = view.cards.map((card) => {
        if (!(card & 2147483648)) {
          return 0;
        }
        return card;
      });
      return view;
    }
    teammateView() {
      return this.opponentView();
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgDraw.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgDraw.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgDraw.prototype, "cards", 2);
  var YGOProMsgEquip_CardLocation = class {
    static {
      __name(this, "YGOProMsgEquip_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgEquip_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgEquip_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgEquip_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgEquip_CardLocation.prototype, "position", 2);
  var YGOProMsgEquip = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgEquip");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_EQUIP;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgEquip_CardLocation, 0)
  ], YGOProMsgEquip.prototype, "equip", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgEquip_CardLocation, 4)
  ], YGOProMsgEquip.prototype, "target", 2);
  var YGOProMsgFieldDisabled = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgFieldDisabled");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_FIELD_DISABLED;
    }
  };
  __decorateClass([
    BinaryField("u32", 0)
  ], YGOProMsgFieldDisabled.prototype, "disabledField", 2);
  var YGOProMsgFlipSummoned = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgFlipSummoned");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_FLIPSUMMONED;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  var YGOProMsgFlipSummoning = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgFlipSummoning");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_FLIPSUMMONING;
    }
    getRequireRefreshCards() {
      return [
        {
          player: this.controller,
          location: this.location,
          sequence: this.sequence
        }
      ];
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgFlipSummoning.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgFlipSummoning.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgFlipSummoning.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgFlipSummoning.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgFlipSummoning.prototype, "position", 2);
  var YGOProMsgHandRes = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgHandRes");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_HAND_RES;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgHandRes.prototype, "result", 2);
  var HINT_TYPES_SEND_TO_SELF = /* @__PURE__ */ new Set([1, 2, 3, 5]);
  var HINT_TYPES_SEND_TO_OPPONENT = /* @__PURE__ */ new Set([4, 6, 7, 8, 9, 11]);
  var YGOProMsgHint = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgHint");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_HINT;
    }
    getSendTargets() {
      if (HINT_TYPES_SEND_TO_SELF.has(this.type)) {
        return [this.player];
      }
      if (HINT_TYPES_SEND_TO_OPPONENT.has(this.type)) {
        return [
          1 - this.player,
          7
          /* OBSERVER */
        ];
      }
      return SEND_TO_ALL;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgHint.prototype, "type", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgHint.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 2)
  ], YGOProMsgHint.prototype, "desc", 2);
  var YGOProMsgLpUpdate = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgLpUpdate");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_LPUPDATE;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgLpUpdate.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgLpUpdate.prototype, "lp", 2);
  var YGOProMsgMatchKill = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgMatchKill");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_MATCH_KILL;
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgMatchKill.prototype, "code", 2);
  var YGOProMsgMissedEffect = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgMissedEffect");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_MISSED_EFFECT;
    }
    getSendTargets() {
      return [this.controller];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgMissedEffect.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgMissedEffect.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgMissedEffect.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgMissedEffect.prototype, "position", 2);
  __decorateClass([
    BinaryField("i32", 4)
  ], YGOProMsgMissedEffect.prototype, "code", 2);
  var YGOProMsgMove_CardLocation = class {
    static {
      __name(this, "YGOProMsgMove_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgMove_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgMove_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgMove_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgMove_CardLocation.prototype, "position", 2);
  var YGOProMsgMove = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgMove");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_MOVE;
    }
    fromPayload(data) {
      super.fromPayload(data);
      decodePublicRevealPosition(this.current);
      return this;
    }
    toPayload() {
      const payload = this.copy();
      payload.current.position = encodePublicRevealPosition(
        payload.current.position,
        payload.current.reveal
      );
      delete payload.current.reveal;
      return YGOProMsgBase.prototype.toPayload.call(payload);
    }
    viewCopy() {
      const view = this.copy();
      sanitizePublicRevealPositionForView(view.previous);
      sanitizePublicRevealPositionForView(view.current);
      return view;
    }
    opponentView() {
      const view = this.viewCopy();
      const cl = view.current.location;
      const cp = this.current.position;
      if (cl & (OcgcoreScriptConstants.LOCATION_GRAVE | OcgcoreScriptConstants.LOCATION_OVERLAY)) {
        return view;
      }
      if (cl & (OcgcoreScriptConstants.LOCATION_DECK | OcgcoreScriptConstants.LOCATION_HAND) || shouldHideFacedownCode(cp, this.current.reveal)) {
        view.code = 0;
      }
      return view;
    }
    teammateView() {
      return this.opponentView();
    }
    playerView(playerId) {
      if (playerId === 7) {
        return this.observerView();
      }
      if (playerId === this.current.controller) {
        return this.viewCopy();
      }
      return this.opponentView();
    }
    getRequireRefreshCards() {
      const current = this.current;
      const previous = this.previous;
      const shouldRefresh = current.location !== 0 && (current.location & OcgcoreScriptConstants.LOCATION_OVERLAY) === 0 && (current.location !== previous.location || current.controller !== previous.controller);
      if (!shouldRefresh) {
        return [];
      }
      return [
        {
          player: current.controller,
          location: current.location,
          sequence: current.sequence
        }
      ];
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgMove.prototype, "code", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgMove_CardLocation, 4)
  ], YGOProMsgMove.prototype, "previous", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgMove_CardLocation, 8)
  ], YGOProMsgMove.prototype, "current", 2);
  __decorateClass([
    BinaryField("i32", 12)
  ], YGOProMsgMove.prototype, "reason", 2);
  var YGOProMsgNewPhase = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgNewPhase");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_NEW_PHASE;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProMsgNewPhase.prototype, "phase", 2);
  var YGOProMsgNewTurn = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgNewTurn");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_NEW_TURN;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgNewTurn.prototype, "player", 2);
  var YGOProMsgPayLpCost = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgPayLpCost");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_PAY_LPCOST;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgPayLpCost.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgPayLpCost.prototype, "cost", 2);
  var YGOProMsgPlayerHint = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgPlayerHint");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_PLAYER_HINT;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgPlayerHint.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgPlayerHint.prototype, "type", 2);
  __decorateClass([
    BinaryField("i32", 2)
  ], YGOProMsgPlayerHint.prototype, "value", 2);
  var YGOProMsgPosChange_CardLocation = class {
    static {
      __name(this, "YGOProMsgPosChange_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgPosChange_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgPosChange_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgPosChange_CardLocation.prototype, "sequence", 2);
  var YGOProMsgPosChange = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgPosChange");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_POS_CHANGE;
    }
    getRequireRefreshCards() {
      const shouldRefresh = (this.previousPosition & OcgcoreCommonConstants.POS_FACEDOWN) !== 0 && (this.currentPosition & OcgcoreCommonConstants.POS_FACEUP) !== 0;
      if (!shouldRefresh) {
        return [];
      }
      return [
        {
          player: this.card.controller,
          location: this.card.location,
          sequence: this.card.sequence
        }
      ];
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgPosChange.prototype, "code", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgPosChange_CardLocation, 4)
  ], YGOProMsgPosChange.prototype, "card", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgPosChange.prototype, "previousPosition", 2);
  __decorateClass([
    BinaryField("u8", 8)
  ], YGOProMsgPosChange.prototype, "currentPosition", 2);
  var YGOProMsgRandomSelected = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgRandomSelected");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_RANDOM_SELECTED;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgRandomSelected.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgRandomSelected.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgRandomSelected.prototype, "cards", 2);
  var YGOProMsgRecover = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgRecover");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_RECOVER;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgRecover.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgRecover.prototype, "value", 2);
  var YGOProMsgReloadField_ZoneCard = class {
    static {
      __name(this, "YGOProMsgReloadField_ZoneCard");
    }
  };
  var YGOProMsgReloadField_PlayerInfo = class {
    static {
      __name(this, "YGOProMsgReloadField_PlayerInfo");
    }
  };
  var YGOProMsgReloadField_ChainInfo = class {
    static {
      __name(this, "YGOProMsgReloadField_ChainInfo");
    }
  };
  var YGOProMsgReloadField = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgReloadField");
    }
    static {
      this.identifier = 162;
    }
    fromPayload(data) {
      if (data.length < 1) {
        throw new Error("MSG data too short");
      }
      const msgType = data[0];
      if (msgType !== this.identifier) {
        throw new Error(
          `MSG type mismatch: expected ${this.identifier}, got ${msgType}`
        );
      }
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      let offset = 1;
      this.duelRule = view.getUint8(offset++);
      this.players = [];
      for (let i = 0; i < 2; i++) {
        const player = {
          lp: view.getInt32(offset, true),
          mzone: [],
          szone: [],
          deckCount: 0,
          handCount: 0,
          graveCount: 0,
          removedCount: 0,
          extraCount: 0,
          extraPCount: 0
        };
        offset += 4;
        for (let seq = 0; seq < 7; seq++) {
          const occupied = view.getUint8(offset++);
          const card = { occupied };
          if (occupied) {
            card.position = view.getUint8(offset++);
            card.xyzCount = view.getUint8(offset++);
          }
          player.mzone.push(card);
        }
        for (let seq = 0; seq < 8; seq++) {
          const occupied = view.getUint8(offset++);
          const card = { occupied };
          if (occupied) {
            card.position = view.getUint8(offset++);
          }
          player.szone.push(card);
        }
        player.deckCount = view.getUint8(offset++);
        player.handCount = view.getUint8(offset++);
        player.graveCount = view.getUint8(offset++);
        player.removedCount = view.getUint8(offset++);
        player.extraCount = view.getUint8(offset++);
        player.extraPCount = view.getUint8(offset++);
        this.players.push(player);
      }
      const chainCount = view.getUint8(offset++);
      this.chains = [];
      for (let i = 0; i < chainCount; i++) {
        const chain = {
          code: view.getInt32(offset, true),
          chainCardController: view.getUint8(offset + 4),
          chainCardLocation: view.getUint8(offset + 5),
          chainCardSequence: view.getUint8(offset + 6),
          chainCardSubsequence: view.getUint8(offset + 7),
          triggerController: view.getUint8(offset + 8),
          triggerLocation: view.getUint8(offset + 9),
          triggerSequence: view.getUint8(offset + 10),
          desc: view.getInt32(offset + 11, true)
        };
        offset += 15;
        this.chains.push(chain);
      }
      return this;
    }
    toPayload() {
      let size = 1 + 1;
      for (const player of this.players) {
        size += 4;
        for (const card of player.mzone) {
          size += 1;
          if (card.occupied) {
            size += 2;
          }
        }
        for (const card of player.szone) {
          size += 1;
          if (card.occupied) {
            size += 1;
          }
        }
        size += 6;
      }
      size += 1;
      size += this.chains.length * 15;
      const result = new Uint8Array(size);
      const view = new DataView(result.buffer);
      let offset = 0;
      result[offset++] = this.identifier;
      result[offset++] = this.duelRule;
      for (const player of this.players) {
        view.setInt32(offset, player.lp, true);
        offset += 4;
        for (const card of player.mzone) {
          result[offset++] = card.occupied;
          if (card.occupied) {
            result[offset++] = card.position || 0;
            result[offset++] = card.xyzCount || 0;
          }
        }
        for (const card of player.szone) {
          result[offset++] = card.occupied;
          if (card.occupied) {
            result[offset++] = card.position || 0;
          }
        }
        result[offset++] = player.deckCount;
        result[offset++] = player.handCount;
        result[offset++] = player.graveCount;
        result[offset++] = player.removedCount;
        result[offset++] = player.extraCount;
        result[offset++] = player.extraPCount;
      }
      result[offset++] = this.chains.length;
      for (const chain of this.chains) {
        view.setInt32(offset, chain.code, true);
        result[offset + 4] = chain.chainCardController;
        result[offset + 5] = chain.chainCardLocation;
        result[offset + 6] = chain.chainCardSequence;
        result[offset + 7] = chain.chainCardSubsequence;
        result[offset + 8] = chain.triggerController;
        result[offset + 9] = chain.triggerLocation;
        result[offset + 10] = chain.triggerSequence;
        view.setInt32(offset + 11, chain.desc, true);
        offset += 15;
      }
      return result;
    }
  };
  var YGOProMsgRemoveCounter = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgRemoveCounter");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_REMOVE_COUNTER;
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProMsgRemoveCounter.prototype, "counterType", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgRemoveCounter.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgRemoveCounter.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgRemoveCounter.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u16", 5)
  ], YGOProMsgRemoveCounter.prototype, "count", 2);
  var YGOProMsgResetTime = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgResetTime");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_RESET_TIME;
    }
    getSendTargets() {
      return [];
    }
  };
  __decorateClass([
    BinaryField("i8", 0)
  ], YGOProMsgResetTime.prototype, "player", 2);
  __decorateClass([
    BinaryField("i16", 1)
  ], YGOProMsgResetTime.prototype, "time", 2);
  var YGOProMsgRetry = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgRetry");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_RETRY;
    }
    getSendTargets() {
      return [];
    }
  };
  var YGOProMsgReverseDeck = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgReverseDeck");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_REVERSE_DECK;
    }
  };
  var YGOProMsgRockPaperScissors = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgRockPaperScissors");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_ROCK_PAPER_SCISSORS;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(choice) {
      if (choice < 1 || choice > 3) {
        throw new TypeError(
          `Invalid choice: ${choice}. Must be 1 (ROCK), 2 (SCISSORS), or 3 (PAPER)`
        );
      }
      const buffer = new Uint8Array(1);
      buffer[0] = choice;
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgRockPaperScissors.prototype, "player", 2);
  var YGOProMsgSelectBattleCmd_ActivatableInfo = class {
    static {
      __name(this, "YGOProMsgSelectBattleCmd_ActivatableInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectBattleCmd_ActivatableInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectBattleCmd_ActivatableInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectBattleCmd_ActivatableInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectBattleCmd_ActivatableInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("i32", 7)
  ], YGOProMsgSelectBattleCmd_ActivatableInfo.prototype, "desc", 2);
  var YGOProMsgSelectBattleCmd_AttackableInfo = class {
    static {
      __name(this, "YGOProMsgSelectBattleCmd_AttackableInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectBattleCmd_AttackableInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectBattleCmd_AttackableInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectBattleCmd_AttackableInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectBattleCmd_AttackableInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectBattleCmd_AttackableInfo.prototype, "directAttack", 2);
  var YGOProMsgSelectBattleCmd = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectBattleCmd");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_BATTLECMD;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(type, option) {
      let sequence;
      if (type === 0) {
        if (option == null) {
          throw new TypeError("Option required for ACTIVATE");
        }
        if (isIndexResponse(option)) {
          sequence = option.index;
          if (sequence < 0 || sequence >= this.activatableCount) {
            throw new TypeError(`Index out of range: ${sequence}`);
          }
        } else {
          const idx = this.activatableCards.findIndex(
            (card) => (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence) && (option.desc == null || card.desc === option.desc)
          );
          if (idx === -1) {
            throw new TypeError("Activatable card not found");
          }
          sequence = idx;
        }
      } else if (type === 1) {
        if (option == null) {
          throw new TypeError("Option required for ATTACK");
        }
        if (isIndexResponse(option)) {
          sequence = option.index;
          if (sequence < 0 || sequence >= this.attackableCount) {
            throw new TypeError(`Index out of range: ${sequence}`);
          }
        } else {
          const idx = this.attackableCards.findIndex(
            (card) => (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence)
          );
          if (idx === -1) {
            throw new TypeError("Attackable card not found");
          }
          sequence = idx;
        }
      } else if (type === 2) {
        if (this.canM2 === 0) {
          throw new TypeError("Cannot go to M2");
        }
        sequence = 0;
      } else if (type === 3) {
        if (this.canEp === 0) {
          throw new TypeError("Cannot go to EP");
        }
        sequence = 0;
      } else {
        throw new TypeError(`Unknown type: ${type}`);
      }
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, sequence << 16 | type, true);
      return buffer;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectBattleCmd.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectBattleCmd.prototype, "activatableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectBattleCmd_ActivatableInfo,
      2,
      (obj) => obj.activatableCount
    )
  ], YGOProMsgSelectBattleCmd.prototype, "activatableCards", 2);
  __decorateClass([
    BinaryField("u8", (obj) => {
      return 2 + obj.activatableCount * 11;
    })
  ], YGOProMsgSelectBattleCmd.prototype, "attackableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectBattleCmd_AttackableInfo,
      (obj) => {
        return 3 + obj.activatableCount * 11;
      },
      (obj) => obj.attackableCount
    )
  ], YGOProMsgSelectBattleCmd.prototype, "attackableCards", 2);
  __decorateClass([
    BinaryField("u8", (obj) => {
      return 3 + obj.activatableCount * 11 + obj.attackableCount * 8;
    })
  ], YGOProMsgSelectBattleCmd.prototype, "canM2", 2);
  __decorateClass([
    BinaryField("u8", (obj) => {
      return 4 + obj.activatableCount * 11 + obj.attackableCount * 8;
    })
  ], YGOProMsgSelectBattleCmd.prototype, "canEp", 2);
  var YGOProMsgSelectCard_CardInfo = class {
    static {
      __name(this, "YGOProMsgSelectCard_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectCard_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectCard_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectCard_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectCard_CardInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectCard_CardInfo.prototype, "subsequence", 2);
  var YGOProMsgSelectCard = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectCard");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_CARD;
    }
    maskedView(playerId) {
      const view = this.copy();
      for (const card of view.cards || []) {
        if (card.controller !== playerId) {
          card.code = 0;
        }
      }
      return view;
    }
    playerView(playerId) {
      return this.maskedView(playerId);
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      if (this.cancelable === 0) {
        return void 0;
      }
      return this.prepareResponse(null);
    }
    prepareResponse(cardOptions) {
      if (cardOptions == null) {
        const buffer2 = new Uint8Array(4);
        const view = new DataView(buffer2.buffer);
        view.setInt32(0, -1, true);
        return buffer2;
      }
      const indices = [];
      const usedIndices = /* @__PURE__ */ new Set();
      for (const option of cardOptions) {
        let index;
        if (isIndexResponse(option)) {
          index = option.index;
          if (index < 0 || index >= this.count) {
            throw new TypeError(`Index out of range: ${index}`);
          }
        } else {
          index = this.cards.findIndex(
            (card, idx) => !usedIndices.has(idx) && (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence)
          );
          if (index === -1) {
            throw new TypeError("Card not found");
          }
        }
        indices.push(index);
        usedIndices.add(index);
      }
      const buffer = new Uint8Array(1 + indices.length);
      buffer[0] = indices.length;
      indices.forEach((idx, i) => {
        buffer[1 + i] = idx;
      });
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectCard.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectCard.prototype, "cancelable", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgSelectCard.prototype, "min", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgSelectCard.prototype, "max", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectCard.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSelectCard_CardInfo, 5, (obj) => obj.count)
  ], YGOProMsgSelectCard.prototype, "cards", 2);
  var YGOProMsgSelectChain_ChainInfo = class {
    static {
      __name(this, "YGOProMsgSelectChain_ChainInfo");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "edesc", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "forced", 2);
  __decorateClass([
    BinaryField("i32", 2)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 8)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 9)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "subsequence", 2);
  __decorateClass([
    BinaryField("i32", 10)
  ], YGOProMsgSelectChain_ChainInfo.prototype, "desc", 2);
  var YGOProMsgSelectChain = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectChain");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_CHAIN;
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      const hasForced = this.chains.some((chain) => chain.forced !== 0);
      if (hasForced) {
        return void 0;
      }
      return this.prepareResponse(null);
    }
    prepareResponse(option) {
      let index;
      if (option == null) {
        index = -1;
      } else if (isIndexResponse(option)) {
        index = option.index;
        if (index < -1 || index >= this.count) {
          throw new TypeError(`Index out of range: ${index}`);
        }
      } else {
        index = this.chains.findIndex(
          (chain) => (option.code == null || chain.code === option.code) && (option.controller == null || chain.controller === option.controller) && (option.location == null || chain.location === option.location) && (option.sequence == null || chain.sequence === option.sequence) && (option.desc == null || chain.desc === option.desc)
        );
        if (index === -1) {
          throw new TypeError("Chain not found");
        }
      }
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, index, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectChain.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectChain.prototype, "count", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgSelectChain.prototype, "specialCount", 2);
  __decorateClass([
    BinaryField("i32", 3)
  ], YGOProMsgSelectChain.prototype, "hint0", 2);
  __decorateClass([
    BinaryField("i32", 7)
  ], YGOProMsgSelectChain.prototype, "hint1", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSelectChain_ChainInfo, 11, (obj) => obj.count)
  ], YGOProMsgSelectChain.prototype, "chains", 2);
  var YGOProMsgSelectCounter_CardInfo = class {
    static {
      __name(this, "YGOProMsgSelectCounter_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectCounter_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectCounter_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectCounter_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectCounter_CardInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u16", 7)
  ], YGOProMsgSelectCounter_CardInfo.prototype, "counterCount", 2);
  var YGOProMsgSelectCounter = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectCounter");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_COUNTER;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(counterOptions) {
      const counterCounts = new Array(this.count).fill(0);
      for (const option of counterOptions) {
        let index;
        if (isIndexResponse(option.card)) {
          index = option.card.index;
          if (index < 0 || index >= this.count) {
            throw new TypeError(`Index out of range: ${index}`);
          }
        } else {
          const card = option.card;
          index = this.cards.findIndex(
            (card2) => (card2.code == null || card2.code === card2.code) && (card2.controller == null || card2.controller === card2.controller) && (card2.location == null || card2.location === card2.location) && (card2.sequence == null || card2.sequence === card2.sequence)
          );
          if (index === -1) {
            throw new TypeError("Card not found");
          }
        }
        counterCounts[index] = option.count;
      }
      const buffer = new Uint8Array(counterCounts.length * 2);
      const view = new DataView(buffer.buffer);
      counterCounts.forEach((count, i) => {
        view.setUint16(i * 2, count, true);
      });
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectCounter.prototype, "player", 2);
  __decorateClass([
    BinaryField("u16", 1)
  ], YGOProMsgSelectCounter.prototype, "counterType", 2);
  __decorateClass([
    BinaryField("u16", 3)
  ], YGOProMsgSelectCounter.prototype, "counterCount", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectCounter.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSelectCounter_CardInfo, 6, (obj) => obj.count)
  ], YGOProMsgSelectCounter.prototype, "cards", 2);
  var YGOProMsgSelectPlaceCommon = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectPlaceCommon");
    }
    getSelectablePlaces() {
      const places = [];
      const mask = this.flag >>> 0;
      let pos = 0;
      for (const player of [this.player, 1 - this.player]) {
        for (const location of [
          OcgcoreScriptConstants.LOCATION_MZONE,
          OcgcoreScriptConstants.LOCATION_SZONE
        ]) {
          for (let sequence = 0; sequence < 8; sequence++) {
            if (!(mask & 1 << pos >>> 0)) {
              places.push({ player, location, sequence });
            }
            ++pos;
          }
        }
      }
      return places;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(places) {
      const buffer = new Uint8Array(places.length * 3);
      places.forEach((place, i) => {
        if (this.flag >>> 0 & 1 << (place.player === this.player ? 0 : 16) + (place.location === OcgcoreScriptConstants.LOCATION_MZONE ? 0 : 8) + place.sequence >>> 0) {
          throw new Error("Selected place is not available");
        }
        buffer[i * 3] = place.player;
        buffer[i * 3 + 1] = place.location;
        buffer[i * 3 + 2] = place.sequence;
      });
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectPlaceCommon.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectPlaceCommon.prototype, "count", 2);
  __decorateClass([
    BinaryField("u32", 2)
  ], YGOProMsgSelectPlaceCommon.prototype, "flag", 2);
  var YGOProMsgSelectDisField = class extends YGOProMsgSelectPlaceCommon {
    static {
      __name(this, "YGOProMsgSelectDisField");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_DISFIELD;
    }
  };
  var YGOProMsgSelectEffectYn = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectEffectYn");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_EFFECTYN;
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      return this.prepareResponse(false);
    }
    prepareResponse(yes) {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, yes ? 1 : 0, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectEffectYn.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgSelectEffectYn.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectEffectYn.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectEffectYn.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectEffectYn.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 8)
  ], YGOProMsgSelectEffectYn.prototype, "position", 2);
  __decorateClass([
    BinaryField("i32", 9)
  ], YGOProMsgSelectEffectYn.prototype, "desc", 2);
  var IdleCmdType = /* @__PURE__ */ ((IdleCmdType2) => {
    IdleCmdType2[IdleCmdType2["SUMMON"] = 0] = "SUMMON";
    IdleCmdType2[IdleCmdType2["SPSUMMON"] = 1] = "SPSUMMON";
    IdleCmdType2[IdleCmdType2["REPOS"] = 2] = "REPOS";
    IdleCmdType2[IdleCmdType2["MSET"] = 3] = "MSET";
    IdleCmdType2[IdleCmdType2["SSET"] = 4] = "SSET";
    IdleCmdType2[IdleCmdType2["ACTIVATE"] = 5] = "ACTIVATE";
    IdleCmdType2[IdleCmdType2["TO_BP"] = 6] = "TO_BP";
    IdleCmdType2[IdleCmdType2["TO_EP"] = 7] = "TO_EP";
    IdleCmdType2[IdleCmdType2["SHUFFLE"] = 8] = "SHUFFLE";
    return IdleCmdType2;
  })(IdleCmdType || {});
  var YGOProMsgSelectIdleCmd_SimpleCardInfo = class {
    static {
      __name(this, "YGOProMsgSelectIdleCmd_SimpleCardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectIdleCmd_SimpleCardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectIdleCmd_SimpleCardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectIdleCmd_SimpleCardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectIdleCmd_SimpleCardInfo.prototype, "sequence", 2);
  var YGOProMsgSelectIdleCmd_ActivatableInfo = class {
    static {
      __name(this, "YGOProMsgSelectIdleCmd_ActivatableInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectIdleCmd_ActivatableInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectIdleCmd_ActivatableInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectIdleCmd_ActivatableInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectIdleCmd_ActivatableInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("i32", 7)
  ], YGOProMsgSelectIdleCmd_ActivatableInfo.prototype, "desc", 2);
  var YGOProMsgSelectIdleCmd = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectIdleCmd");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_IDLECMD;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(type, option) {
      let sequence;
      if (type === 0 || type === 1 || type === 2 || type === 3 || type === 4 || type === 5) {
        if (option == null) {
          throw new TypeError(`Option required for ${IdleCmdType[type]}`);
        }
        let cards;
        let maxCount;
        let typeName;
        if (type === 0) {
          cards = this.summonableCards;
          maxCount = this.summonableCount;
          typeName = "Summonable";
        } else if (type === 1) {
          cards = this.spSummonableCards;
          maxCount = this.spSummonableCount;
          typeName = "Special summonable";
        } else if (type === 2) {
          cards = this.reposableCards;
          maxCount = this.reposableCount;
          typeName = "Repositionable";
        } else if (type === 3) {
          cards = this.msetableCards;
          maxCount = this.msetableCount;
          typeName = "Monster settable";
        } else if (type === 4) {
          cards = this.ssetableCards;
          maxCount = this.ssetableCount;
          typeName = "Spell/Trap settable";
        } else {
          cards = this.activatableCards;
          maxCount = this.activatableCount;
          typeName = "Activatable";
        }
        if (isIndexResponse(option)) {
          sequence = option.index;
          if (sequence < 0 || sequence >= maxCount) {
            throw new TypeError(`Index out of range: ${sequence}`);
          }
        } else {
          const idx = cards.findIndex(
            (card) => (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence) && (option.desc == null || card.desc === option.desc)
          );
          if (idx === -1) {
            throw new TypeError(`${typeName} card not found`);
          }
          sequence = idx;
        }
      } else if (type === 6) {
        if (this.canBp === 0) {
          throw new TypeError("Cannot go to BP");
        }
        sequence = 0;
      } else if (type === 7) {
        if (this.canEp === 0) {
          throw new TypeError("Cannot go to EP");
        }
        sequence = 0;
      } else if (type === 8) {
        if (this.canShuffle === 0) {
          throw new TypeError("Cannot shuffle");
        }
        sequence = 0;
      } else {
        throw new TypeError(`Unknown type: ${type}`);
      }
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setUint32(0, sequence << 16 | type, true);
      return buffer;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectIdleCmd.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectIdleCmd.prototype, "summonableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectIdleCmd_SimpleCardInfo,
      2,
      (obj) => obj.summonableCount
    )
  ], YGOProMsgSelectIdleCmd.prototype, "summonableCards", 2);
  __decorateClass([
    BinaryField("u8", (obj) => 2 + obj.summonableCount * 7)
  ], YGOProMsgSelectIdleCmd.prototype, "spSummonableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectIdleCmd_SimpleCardInfo,
      (obj) => 3 + obj.summonableCount * 7,
      (obj) => obj.spSummonableCount
    )
  ], YGOProMsgSelectIdleCmd.prototype, "spSummonableCards", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 3 + obj.summonableCount * 7 + obj.spSummonableCount * 7
    )
  ], YGOProMsgSelectIdleCmd.prototype, "reposableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectIdleCmd_SimpleCardInfo,
      (obj) => 4 + obj.summonableCount * 7 + obj.spSummonableCount * 7,
      (obj) => obj.reposableCount
    )
  ], YGOProMsgSelectIdleCmd.prototype, "reposableCards", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 4 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7
    )
  ], YGOProMsgSelectIdleCmd.prototype, "msetableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectIdleCmd_SimpleCardInfo,
      (obj) => 5 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7,
      (obj) => obj.msetableCount
    )
  ], YGOProMsgSelectIdleCmd.prototype, "msetableCards", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 5 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7
    )
  ], YGOProMsgSelectIdleCmd.prototype, "ssetableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectIdleCmd_SimpleCardInfo,
      (obj) => 6 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7,
      (obj) => obj.ssetableCount
    )
  ], YGOProMsgSelectIdleCmd.prototype, "ssetableCards", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 6 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7 + obj.ssetableCount * 7
    )
  ], YGOProMsgSelectIdleCmd.prototype, "activatableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectIdleCmd_ActivatableInfo,
      (obj) => 7 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7 + obj.ssetableCount * 7,
      (obj) => obj.activatableCount
    )
  ], YGOProMsgSelectIdleCmd.prototype, "activatableCards", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 7 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7 + obj.ssetableCount * 7 + obj.activatableCount * 11
    )
  ], YGOProMsgSelectIdleCmd.prototype, "canBp", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 8 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7 + obj.ssetableCount * 7 + obj.activatableCount * 11
    )
  ], YGOProMsgSelectIdleCmd.prototype, "canEp", 2);
  __decorateClass([
    BinaryField(
      "u8",
      (obj) => 9 + obj.summonableCount * 7 + obj.spSummonableCount * 7 + obj.reposableCount * 7 + obj.msetableCount * 7 + obj.ssetableCount * 7 + obj.activatableCount * 11
    )
  ], YGOProMsgSelectIdleCmd.prototype, "canShuffle", 2);
  var YGOProMsgSelectOption = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectOption");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_OPTION;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(option) {
      let index;
      if (isIndexResponse(option)) {
        index = option.index;
        if (index < 0 || index >= this.count) {
          throw new TypeError(`Index out of range: ${index}`);
        }
      } else {
        index = this.options.indexOf(option);
        if (index === -1) {
          throw new TypeError(`Option not found: ${option}`);
        }
      }
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, index, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectOption.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectOption.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgSelectOption.prototype, "options", 2);
  var YGOProMsgSelectPlace = class extends YGOProMsgSelectPlaceCommon {
    static {
      __name(this, "YGOProMsgSelectPlace");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_PLACE;
    }
  };
  var YGOProMsgSelectPosition = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectPosition");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_POSITION;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(position) {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, position, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectPosition.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgSelectPosition.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectPosition.prototype, "positions", 2);
  var YGOProMsgSelectSum_CardInfo = class {
    static {
      __name(this, "YGOProMsgSelectSum_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectSum_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectSum_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectSum_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectSum_CardInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("i32", 7)
  ], YGOProMsgSelectSum_CardInfo.prototype, "opParam", 2);
  var YGOProMsgSelectSum = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectSum");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_SUM;
    }
    responsePlayer() {
      return this.player;
    }
    prepareResponse(cardOptions) {
      const indices = [];
      for (const option of cardOptions) {
        let index;
        if (isIndexResponse(option)) {
          index = option.index;
          if (index < 0 || index >= this.count) {
            throw new TypeError(`Index out of range: ${index}`);
          }
        } else {
          index = this.cards.findIndex(
            (card) => (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence)
          );
          if (index === -1) {
            throw new TypeError("Card not found");
          }
        }
        indices.push(index);
      }
      const buffer = new Uint8Array(1 + indices.length);
      buffer[0] = this.mustSelectCount + indices.length;
      indices.forEach((idx, i) => {
        buffer[1 + i] = idx;
      });
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectSum.prototype, "mode", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectSum.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 2)
  ], YGOProMsgSelectSum.prototype, "sumVal", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectSum.prototype, "min", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectSum.prototype, "max", 2);
  __decorateClass([
    BinaryField("u8", 8)
  ], YGOProMsgSelectSum.prototype, "mustSelectCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectSum_CardInfo,
      9,
      (obj) => obj.mustSelectCount
    )
  ], YGOProMsgSelectSum.prototype, "mustSelectCards", 2);
  __decorateClass([
    BinaryField("u8", (obj) => {
      return 9 + obj.mustSelectCount * 11;
    })
  ], YGOProMsgSelectSum.prototype, "count", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectSum_CardInfo,
      (obj) => {
        return 10 + obj.mustSelectCount * 11;
      },
      (obj) => obj.count
    )
  ], YGOProMsgSelectSum.prototype, "cards", 2);
  var YGOProMsgSelectTribute_CardInfo = class {
    static {
      __name(this, "YGOProMsgSelectTribute_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectTribute_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectTribute_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectTribute_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectTribute_CardInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectTribute_CardInfo.prototype, "releaseParam", 2);
  var YGOProMsgSelectTribute = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectTribute");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_TRIBUTE;
    }
    maskedView(playerId) {
      const view = this.copy();
      for (const card of view.cards || []) {
        if (card.controller !== playerId) {
          card.code = 0;
        }
      }
      return view;
    }
    playerView(playerId) {
      return this.maskedView(playerId);
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      if (this.cancelable === 0) {
        return void 0;
      }
      return this.prepareResponse(null);
    }
    prepareResponse(cardOptions) {
      if (cardOptions == null) {
        const buffer2 = new Uint8Array(4);
        const view = new DataView(buffer2.buffer);
        view.setInt32(0, -1, true);
        return buffer2;
      }
      const indices = [];
      const usedIndices = /* @__PURE__ */ new Set();
      for (const option of cardOptions) {
        let index;
        if (isIndexResponse(option)) {
          index = option.index;
          if (index < 0 || index >= this.count) {
            throw new TypeError(`Index out of range: ${index}`);
          }
        } else {
          index = this.cards.findIndex(
            (card, idx) => !usedIndices.has(idx) && (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence)
          );
          if (index === -1) {
            throw new TypeError("Card not found");
          }
        }
        indices.push(index);
        usedIndices.add(index);
      }
      const buffer = new Uint8Array(1 + indices.length);
      buffer[0] = indices.length;
      indices.forEach((idx, i) => {
        buffer[1 + i] = idx;
      });
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectTribute.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectTribute.prototype, "cancelable", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgSelectTribute.prototype, "min", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgSelectTribute.prototype, "max", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectTribute.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSelectTribute_CardInfo, 5, (obj) => obj.count)
  ], YGOProMsgSelectTribute.prototype, "cards", 2);
  var YGOProMsgSelectUnselectCard_CardInfo = class {
    static {
      __name(this, "YGOProMsgSelectUnselectCard_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSelectUnselectCard_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectUnselectCard_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectUnselectCard_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSelectUnselectCard_CardInfo.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSelectUnselectCard_CardInfo.prototype, "subsequence", 2);
  var YGOProMsgSelectUnselectCard = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectUnselectCard");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_UNSELECT_CARD;
    }
    maskedView(playerId) {
      const view = this.copy();
      for (const card of view.selectableCards || []) {
        if (card.controller !== playerId) {
          card.code = 0;
        }
      }
      for (const card of view.unselectableCards || []) {
        if (card.controller !== playerId) {
          card.code = 0;
        }
      }
      return view;
    }
    playerView(playerId) {
      return this.maskedView(playerId);
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      if (this.cancelable === 0 && this.finishable === 0) {
        return void 0;
      }
      return this.prepareResponse(null);
    }
    prepareResponse(cardOption) {
      if (cardOption == null) {
        const buffer2 = new Uint8Array(4);
        const view = new DataView(buffer2.buffer);
        view.setInt32(0, -1, true);
        return buffer2;
      }
      let index;
      if (isIndexResponse(cardOption)) {
        index = cardOption.index;
        const totalCount = this.selectableCount + this.unselectableCount;
        if (index < 0 || index >= totalCount) {
          throw new TypeError(`Index out of range: ${index}`);
        }
      } else {
        index = this.selectableCards.findIndex(
          (card) => (cardOption.code == null || card.code === cardOption.code) && (cardOption.controller == null || card.controller === cardOption.controller) && (cardOption.location == null || card.location === cardOption.location) && (cardOption.sequence == null || card.sequence === cardOption.sequence)
        );
        if (index === -1) {
          const unselectIndex = this.unselectableCards.findIndex(
            (card) => (cardOption.code == null || card.code === cardOption.code) && (cardOption.controller == null || card.controller === cardOption.controller) && (cardOption.location == null || card.location === cardOption.location) && (cardOption.sequence == null || card.sequence === cardOption.sequence)
          );
          if (unselectIndex === -1) {
            throw new TypeError("Card not found");
          }
          index = this.selectableCount + unselectIndex;
        }
      }
      const buffer = new Uint8Array(2);
      buffer[0] = 1;
      buffer[1] = index;
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectUnselectCard.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSelectUnselectCard.prototype, "finishable", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgSelectUnselectCard.prototype, "cancelable", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgSelectUnselectCard.prototype, "min", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSelectUnselectCard.prototype, "max", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSelectUnselectCard.prototype, "selectableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectUnselectCard_CardInfo,
      6,
      (obj) => obj.selectableCount
    )
  ], YGOProMsgSelectUnselectCard.prototype, "selectableCards", 2);
  __decorateClass([
    BinaryField("u8", (obj) => {
      return 6 + obj.selectableCount * 8;
    })
  ], YGOProMsgSelectUnselectCard.prototype, "unselectableCount", 2);
  __decorateClass([
    BinaryField(
      () => YGOProMsgSelectUnselectCard_CardInfo,
      (obj) => {
        return 7 + obj.selectableCount * 8;
      },
      (obj) => obj.unselectableCount
    )
  ], YGOProMsgSelectUnselectCard.prototype, "unselectableCards", 2);
  var YGOProMsgSelectYesNo = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSelectYesNo");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SELECT_YESNO;
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      return this.prepareResponse(false);
    }
    prepareResponse(yes) {
      const buffer = new Uint8Array(4);
      const view = new DataView(buffer.buffer);
      view.setInt32(0, yes ? 1 : 0, true);
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSelectYesNo.prototype, "player", 2);
  __decorateClass([
    BinaryField("i32", 1)
  ], YGOProMsgSelectYesNo.prototype, "desc", 2);
  var YGOProMsgSet = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSet");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SET;
    }
    // MSG_SET 的 code 在常见网络转发路径会被置 0
    opponentView() {
      const view = this.copy();
      view.code = 0;
      return view;
    }
    teammateView() {
      const view = this.copy();
      view.code = 0;
      return view;
    }
    observerView() {
      const view = this.copy();
      view.code = 0;
      return view;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    playerView(playerId) {
      const view = this.copy();
      view.code = 0;
      return view;
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSet.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSet.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSet.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSet.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSet.prototype, "position", 2);
  var YGOProMsgShuffleDeck = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgShuffleDeck");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SHUFFLE_DECK;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgShuffleDeck.prototype, "player", 2);
  var YGOProMsgShuffleExtra = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgShuffleExtra");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SHUFFLE_EXTRA;
    }
    // 对方视角需要隐藏额外卡组信息
    opponentView() {
      const view = this.copy();
      view.cards = view.cards.map(() => 0);
      return view;
    }
    teammateView() {
      return this.opponentView();
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgShuffleExtra.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgShuffleExtra.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgShuffleExtra.prototype, "cards", 2);
  var YGOProMsgShuffleHand = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgShuffleHand");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SHUFFLE_HAND;
    }
    // 对方视角需要隐藏手牌信息
    opponentView() {
      const view = this.copy();
      view.cards = view.cards.map(() => 0);
      return view;
    }
    teammateView() {
      return this.opponentView();
    }
    getRequireRefreshZones() {
      return [
        {
          player: this.player,
          location: OcgcoreScriptConstants.LOCATION_HAND
        }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgShuffleHand.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgShuffleHand.prototype, "count", 2);
  __decorateClass([
    BinaryField("i32", 2, (obj) => obj.count)
  ], YGOProMsgShuffleHand.prototype, "cards", 2);
  var YGOProMsgShuffleSetCard_CardLocation = class {
    static {
      __name(this, "YGOProMsgShuffleSetCard_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgShuffleSetCard_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgShuffleSetCard_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgShuffleSetCard_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgShuffleSetCard_CardLocation.prototype, "position", 2);
  var YGOProMsgShuffleSetCard_SetCardInfo = class {
    static {
      __name(this, "YGOProMsgShuffleSetCard_SetCardInfo");
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgShuffleSetCard_CardLocation, 0)
  ], YGOProMsgShuffleSetCard_SetCardInfo.prototype, "oldLocation", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgShuffleSetCard_CardLocation, 4)
  ], YGOProMsgShuffleSetCard_SetCardInfo.prototype, "newLocation", 2);
  var YGOProMsgShuffleSetCard = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgShuffleSetCard");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SHUFFLE_SET_CARD;
    }
    getRequireRefreshZones() {
      let location = 0;
      if (this.location === OcgcoreScriptConstants.LOCATION_MZONE) {
        location = OcgcoreScriptConstants.LOCATION_MZONE;
      }
      if (this.location === OcgcoreScriptConstants.LOCATION_SZONE) {
        location = OcgcoreScriptConstants.LOCATION_SZONE;
      }
      if (location === 0) {
        return [];
      }
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgShuffleSetCard.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgShuffleSetCard.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgShuffleSetCard_SetCardInfo, 2, (obj) => obj.count)
  ], YGOProMsgShuffleSetCard.prototype, "cards", 2);
  var YGOProMsgSortCard_CardInfo = class {
    static {
      __name(this, "YGOProMsgSortCard_CardInfo");
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSortCard_CardInfo.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSortCard_CardInfo.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSortCard_CardInfo.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSortCard_CardInfo.prototype, "sequence", 2);
  var YGOProMsgSortCard = class extends YGOProMsgResponseBase {
    static {
      __name(this, "YGOProMsgSortCard");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SORT_CARD;
    }
    responsePlayer() {
      return this.player;
    }
    defaultResponse() {
      return this.prepareResponse(null);
    }
    prepareResponse(sortedOptions) {
      if (sortedOptions == null) {
        return new Uint8Array([255]);
      }
      const indices = [];
      const usedIndices = /* @__PURE__ */ new Set();
      for (const option of sortedOptions) {
        let index;
        if (isIndexResponse(option)) {
          index = option.index;
          if (index < 0 || index >= this.count) {
            throw new TypeError(`Index out of range: ${index}`);
          }
        } else {
          index = this.cards.findIndex(
            (card, idx) => !usedIndices.has(idx) && (option.code == null || card.code === option.code) && (option.controller == null || card.controller === option.controller) && (option.location == null || card.location === option.location) && (option.sequence == null || card.sequence === option.sequence)
          );
          if (index === -1) {
            throw new TypeError("Card not found");
          }
        }
        indices.push(index);
        usedIndices.add(index);
      }
      const buffer = new Uint8Array(indices.length);
      indices.forEach((idx, i) => {
        buffer[i] = idx;
      });
      return buffer;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSortCard.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSortCard.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSortCard_CardInfo, 2, (obj) => obj.count)
  ], YGOProMsgSortCard.prototype, "cards", 2);
  var YGOProMsgSpSummoned = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSpSummoned");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SPSUMMONED;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  var YGOProMsgSpSummoning = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSpSummoning");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SPSUMMONING;
    }
    fromPayload(data) {
      super.fromPayload(data);
      decodePublicRevealPosition(this);
      return this;
    }
    toPayload() {
      const payload = this.copy();
      payload.position = encodePublicRevealPosition(
        payload.position,
        payload.reveal
      );
      delete payload.reveal;
      return YGOProMsgBase.prototype.toPayload.call(payload);
    }
    viewCopy() {
      const view = this.copy();
      sanitizePublicRevealPositionForView(view);
      return view;
    }
    opponentView() {
      const view = this.viewCopy();
      if (shouldHideFacedownCode(this.position, this.reveal)) {
        view.code = 0;
      }
      return view;
    }
    teammateView() {
      return this.viewCopy();
    }
    playerView(playerId) {
      if (playerId === 7) {
        return this.observerView();
      }
      if (playerId === this.controller) {
        return this.viewCopy();
      }
      return this.opponentView();
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSpSummoning.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSpSummoning.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSpSummoning.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSpSummoning.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSpSummoning.prototype, "position", 2);
  var YGOProMsgStart_PlayerInfo = class {
    static {
      __name(this, "YGOProMsgStart_PlayerInfo");
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProMsgStart_PlayerInfo.prototype, "deckCount", 2);
  __decorateClass([
    BinaryField("u16", 2)
  ], YGOProMsgStart_PlayerInfo.prototype, "extraCount", 2);
  var YGOProMsgStart = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgStart");
    }
    static {
      this.identifier = 4;
    }
    /**
     * Get/Set player number (low 4 bits, 0-3)
     */
    get playerNumber() {
      return this.playerType & 15;
    }
    set playerNumber(value) {
      this.playerType = this.playerType & 240 | value & 15;
    }
    /**
     * Get/Set observer flag (high 4 bits, 0x00 or 0x10)
     */
    get observerFlag() {
      return this.playerType & 240;
    }
    set observerFlag(value) {
      this.playerType = this.playerType & 15 | value & 240;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgStart.prototype, "playerType", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgStart.prototype, "duelRule", 2);
  __decorateClass([
    BinaryField("i32", 2)
  ], YGOProMsgStart.prototype, "startLp0", 2);
  __decorateClass([
    BinaryField("i32", 6)
  ], YGOProMsgStart.prototype, "startLp1", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgStart_PlayerInfo, 10)
  ], YGOProMsgStart.prototype, "player0", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgStart_PlayerInfo, 14)
  ], YGOProMsgStart.prototype, "player1", 2);
  var YGOProMsgSummoned = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSummoned");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SUMMONED;
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  var YGOProMsgSummoning = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSummoning");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SUMMONING;
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSummoning.prototype, "code", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgSummoning.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 5)
  ], YGOProMsgSummoning.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 6)
  ], YGOProMsgSummoning.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 7)
  ], YGOProMsgSummoning.prototype, "position", 2);
  var YGOProMsgSwap_CardLocation = class {
    static {
      __name(this, "YGOProMsgSwap_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSwap_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgSwap_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgSwap_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgSwap_CardLocation.prototype, "position", 2);
  var YGOProMsgSwap = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSwap");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SWAP;
    }
    getRequireRefreshCards() {
      return [
        {
          player: this.card1.controller,
          location: this.card1.location,
          sequence: this.card1.sequence
        },
        {
          player: this.card2.controller,
          location: this.card2.location,
          sequence: this.card2.sequence
        }
      ];
    }
  };
  __decorateClass([
    BinaryField("i32", 0)
  ], YGOProMsgSwap.prototype, "code1", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSwap_CardLocation, 4)
  ], YGOProMsgSwap.prototype, "card1", 2);
  __decorateClass([
    BinaryField("i32", 8)
  ], YGOProMsgSwap.prototype, "code2", 2);
  __decorateClass([
    BinaryField(() => YGOProMsgSwap_CardLocation, 12)
  ], YGOProMsgSwap.prototype, "card2", 2);
  var YGOProMsgSwapGraveDeck = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgSwapGraveDeck");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_SWAP_GRAVE_DECK;
    }
    getRequireRefreshZones() {
      return [
        {
          player: this.player,
          location: OcgcoreScriptConstants.LOCATION_GRAVE
        }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgSwapGraveDeck.prototype, "player", 2);
  var YGOProMsgTagSwap = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgTagSwap");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_TAG_SWAP;
    }
    // 对方和队友视角需要隐藏手牌和额外卡组信息
    opponentView() {
      const view = this.copy();
      view.handCards = view.handCards.map((card) => {
        if (!(card & 2147483648)) {
          return 0;
        }
        return card;
      });
      view.extraCards = view.extraCards.map((card) => {
        if (!(card & 2147483648)) {
          return 0;
        }
        return card;
      });
      return view;
    }
    teammateView() {
      return this.opponentView();
    }
    getRequireRefreshZones() {
      const location = OcgcoreScriptConstants.LOCATION_MZONE | OcgcoreScriptConstants.LOCATION_SZONE | OcgcoreScriptConstants.LOCATION_HAND;
      return [
        { player: 0, location },
        { player: 1, location }
      ];
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgTagSwap.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgTagSwap.prototype, "mzoneCount", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgTagSwap.prototype, "extraCount", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgTagSwap.prototype, "pzoneCount", 2);
  __decorateClass([
    BinaryField("u8", 4)
  ], YGOProMsgTagSwap.prototype, "handCount", 2);
  __decorateClass([
    BinaryField("i32", 5)
  ], YGOProMsgTagSwap.prototype, "topCode", 2);
  __decorateClass([
    BinaryField("i32", 9, (obj) => obj.handCount)
  ], YGOProMsgTagSwap.prototype, "handCards", 2);
  __decorateClass([
    BinaryField("i32", (obj) => 9 + obj.handCount * 4, (obj) => obj.extraCount)
  ], YGOProMsgTagSwap.prototype, "extraCards", 2);
  var YGOProMsgTossCoin = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgTossCoin");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_TOSS_COIN;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgTossCoin.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgTossCoin.prototype, "count", 2);
  __decorateClass([
    BinaryField("u8", 2, (obj) => obj.count)
  ], YGOProMsgTossCoin.prototype, "results", 2);
  var YGOProMsgTossDice = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgTossDice");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_TOSS_DICE;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgTossDice.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgTossDice.prototype, "count", 2);
  __decorateClass([
    BinaryField("u8", 2, (obj) => obj.count)
  ], YGOProMsgTossDice.prototype, "results", 2);
  var YGOProMsgUnequip_CardLocation = class {
    static {
      __name(this, "YGOProMsgUnequip_CardLocation");
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgUnequip_CardLocation.prototype, "controller", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgUnequip_CardLocation.prototype, "location", 2);
  __decorateClass([
    BinaryField("u8", 2)
  ], YGOProMsgUnequip_CardLocation.prototype, "sequence", 2);
  __decorateClass([
    BinaryField("u8", 3)
  ], YGOProMsgUnequip_CardLocation.prototype, "position", 2);
  var YGOProMsgUnequip = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgUnequip");
    }
    static {
      this.identifier = 95;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProMsgUnequip_CardLocation, 0)
  ], YGOProMsgUnequip.prototype, "card", 2);
  var YGOProMsgUpdateCard = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgUpdateCard");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_UPDATE_CARD;
    }
    isOnFieldLocation() {
      return !!(this.location & OcgcoreScriptConstants.LOCATION_ONFIELD);
    }
    viewCopy() {
      const copy = this.copy();
      sanitizePublicRevealPositionForView(copy.card);
      return copy;
    }
    opponentView() {
      const copy = this.copy();
      const position = getCardQueryPosition(copy.card);
      const reveal = this.isOnFieldLocation() ? copy.card?.reveal : void 0;
      if (shouldHideFacedownCode(position, reveal)) {
        copy.card = createCodeHiddenCardQuery(copy.card);
      } else {
        sanitizePublicRevealPositionForView(copy.card);
      }
      return copy;
    }
    teammateView() {
      return this.viewCopy();
    }
    playerView(playerId) {
      if (playerId === 7) {
        return this.observerView();
      }
      if (this.controller === playerId) {
        return this.viewCopy();
      }
      return this.opponentView();
    }
    fromPayload(data) {
      if (data.length < 1) {
        throw new Error("MSG data too short");
      }
      const msgType = data[0];
      if (msgType !== this.identifier) {
        throw new Error(
          `MSG type mismatch: expected ${this.identifier}, got ${msgType}`
        );
      }
      if (data.length < 4) {
        throw new Error("MSG_UPDATE_CARD data too short");
      }
      this.controller = data[1];
      this.location = data[2];
      this.sequence = data[3];
      const queryDataWithLength = data.slice(4);
      const { card } = parseCardQueryChunk(
        queryDataWithLength,
        0,
        "MSG_UPDATE_CARD"
      );
      this.card = card;
      return this;
    }
    toPayload() {
      const chunk = serializeCardQueryChunk(this.card);
      const result = new Uint8Array(4 + chunk.length);
      const view = new DataView(result.buffer);
      result[0] = this.identifier;
      result[1] = this.controller;
      result[2] = this.location;
      result[3] = this.sequence;
      view.setInt32(4, chunk.length, true);
      if (chunk.payload.length > 0) {
        result.set(chunk.payload, 8);
      }
      return result;
    }
    getRequireRefreshCards() {
      return [
        {
          player: this.controller,
          location: this.location,
          sequence: this.sequence
        }
      ];
    }
  };
  var YGOProMsgUpdateData = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgUpdateData");
    }
    static {
      this.identifier = 6;
    }
    getFixedSlotCount() {
      if (this.location === OcgcoreScriptConstants.LOCATION_MZONE) {
        return 7;
      }
      if (this.location === OcgcoreScriptConstants.LOCATION_SZONE) {
        return 8;
      }
      return void 0;
    }
    shouldHideForOpponent(card) {
      const position = getCardQueryPosition(card);
      if (this.location === OcgcoreScriptConstants.LOCATION_GRAVE) {
        return false;
      }
      if (this.location === OcgcoreScriptConstants.LOCATION_HAND) {
        return !position || !(position & OcgcoreCommonConstants.POS_FACEUP);
      }
      const reveal = this.location & OcgcoreScriptConstants.LOCATION_ONFIELD ? card.reveal : void 0;
      return shouldHideFacedownCode(position, reveal);
    }
    shouldHideForTeammate(card) {
      const position = getCardQueryPosition(card);
      if (this.location === OcgcoreScriptConstants.LOCATION_MZONE || this.location === OcgcoreScriptConstants.LOCATION_SZONE || this.location === OcgcoreScriptConstants.LOCATION_REMOVED || this.location === OcgcoreScriptConstants.LOCATION_GRAVE) {
        return false;
      }
      if (this.location === OcgcoreScriptConstants.LOCATION_HAND) {
        return !position || !(position & OcgcoreCommonConstants.POS_FACEUP);
      }
      if (this.location === OcgcoreScriptConstants.LOCATION_EXTRA) {
        return !!(position && position & OcgcoreCommonConstants.POS_FACEDOWN);
      }
      return false;
    }
    opponentView() {
      const copy = this.copy();
      if (copy.cards) {
        copy.cards = copy.cards.map((card) => {
          if (this.shouldHideForOpponent(card)) {
            return createClearedCardQuery(card);
          }
          sanitizePublicRevealPositionForView(card);
          return card;
        });
      }
      return copy;
    }
    teammateView() {
      const copy = this.copy();
      if (copy.cards) {
        copy.cards = copy.cards.map((card) => {
          if (this.shouldHideForTeammate(card)) {
            return createClearedCardQuery(card);
          }
          sanitizePublicRevealPositionForView(card);
          return card;
        });
      }
      return copy;
    }
    playerView(playerId) {
      if (playerId === 7) {
        return this.observerView();
      }
      if (this.player === playerId) {
        const copy = this.copy();
        if (copy.cards) {
          copy.cards = copy.cards.map((card) => {
            sanitizePublicRevealPositionForView(card);
            return card;
          });
        }
        return copy;
      }
      return this.opponentView();
    }
    fromPayload(data) {
      if (data.length < 1) {
        throw new Error("MSG data too short");
      }
      const msgType = data[0];
      if (msgType !== this.identifier) {
        throw new Error(
          `MSG type mismatch: expected ${this.identifier}, got ${msgType}`
        );
      }
      if (data.length < 3) {
        throw new Error("MSG_UPDATE_DATA data too short");
      }
      this.player = data[1];
      this.location = data[2];
      this.cards = [];
      let offset = 3;
      while (offset < data.length) {
        const { card, length } = parseCardQueryChunk(
          data,
          offset,
          "MSG_UPDATE_DATA"
        );
        this.cards.push(card);
        offset += length;
      }
      return this;
    }
    toPayload() {
      const inputCards = this.cards || [];
      const fixedSlotCount = this.getFixedSlotCount();
      let cardsToEncode = inputCards;
      if (fixedSlotCount !== void 0) {
        if (inputCards.length > fixedSlotCount) {
          throw new Error(
            `MSG_UPDATE_DATA location ${this.location} expects at most ${fixedSlotCount} chunks, got ${inputCards.length}`
          );
        }
        if (inputCards.length < fixedSlotCount) {
          cardsToEncode = inputCards.slice();
          for (let i = inputCards.length; i < fixedSlotCount; i++) {
            cardsToEncode.push(createClearedCardQuery());
          }
        }
      }
      let totalSize = 3;
      const chunks = [];
      for (const card of cardsToEncode) {
        const chunk = serializeCardQueryChunk(card);
        chunks.push(chunk);
        totalSize += chunk.length;
      }
      const result = new Uint8Array(totalSize);
      const view = new DataView(result.buffer);
      let offset = 0;
      result[offset++] = this.identifier;
      result[offset++] = this.player;
      result[offset++] = this.location;
      for (const chunk of chunks) {
        view.setInt32(offset, chunk.length, true);
        offset += 4;
        if (chunk.payload.length > 0) {
          result.set(chunk.payload, offset);
          offset += chunk.payload.length;
        }
      }
      return result;
    }
  };
  var YGOProMsgWaiting = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgWaiting");
    }
    static {
      this.identifier = 3;
    }
    // MSG_WAITING
    getSendTargets() {
      return [];
    }
  };
  var YGOProMsgWin = class extends YGOProMsgBase {
    static {
      __name(this, "YGOProMsgWin");
    }
    static {
      this.identifier = OcgcoreCommonConstants.MSG_WIN;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProMsgWin.prototype, "player", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProMsgWin.prototype, "type", 2);
  var YGOProMessages = new RegistryBase(YGOProMsgBase);
  YGOProMessages.register(YGOProMsgRetry);
  YGOProMessages.register(YGOProMsgHint);
  YGOProMessages.register(YGOProMsgWin);
  YGOProMessages.register(YGOProMsgSelectBattleCmd);
  YGOProMessages.register(YGOProMsgSelectIdleCmd);
  YGOProMessages.register(YGOProMsgSelectEffectYn);
  YGOProMessages.register(YGOProMsgSelectYesNo);
  YGOProMessages.register(YGOProMsgSelectOption);
  YGOProMessages.register(YGOProMsgSelectCard);
  YGOProMessages.register(YGOProMsgSelectChain);
  YGOProMessages.register(YGOProMsgSelectPlace);
  YGOProMessages.register(YGOProMsgSelectPosition);
  YGOProMessages.register(YGOProMsgSelectTribute);
  YGOProMessages.register(YGOProMsgSelectCounter);
  YGOProMessages.register(YGOProMsgSelectSum);
  YGOProMessages.register(YGOProMsgSelectDisField);
  YGOProMessages.register(YGOProMsgSortCard);
  YGOProMessages.register(YGOProMsgSelectUnselectCard);
  YGOProMessages.register(YGOProMsgConfirmDeckTop);
  YGOProMessages.register(YGOProMsgConfirmCards);
  YGOProMessages.register(YGOProMsgShuffleDeck);
  YGOProMessages.register(YGOProMsgShuffleHand);
  YGOProMessages.register(YGOProMsgSwapGraveDeck);
  YGOProMessages.register(YGOProMsgShuffleExtra);
  YGOProMessages.register(YGOProMsgShuffleSetCard);
  YGOProMessages.register(YGOProMsgReverseDeck);
  YGOProMessages.register(YGOProMsgDeckTop);
  YGOProMessages.register(YGOProMsgNewTurn);
  YGOProMessages.register(YGOProMsgNewPhase);
  YGOProMessages.register(YGOProMsgConfirmExtraTop);
  YGOProMessages.register(YGOProMsgMove);
  YGOProMessages.register(YGOProMsgPosChange);
  YGOProMessages.register(YGOProMsgSet);
  YGOProMessages.register(YGOProMsgSwap);
  YGOProMessages.register(YGOProMsgFieldDisabled);
  YGOProMessages.register(YGOProMsgSummoning);
  YGOProMessages.register(YGOProMsgSummoned);
  YGOProMessages.register(YGOProMsgSpSummoning);
  YGOProMessages.register(YGOProMsgSpSummoned);
  YGOProMessages.register(YGOProMsgFlipSummoning);
  YGOProMessages.register(YGOProMsgFlipSummoned);
  YGOProMessages.register(YGOProMsgChaining);
  YGOProMessages.register(YGOProMsgChained);
  YGOProMessages.register(YGOProMsgChainSolving);
  YGOProMessages.register(YGOProMsgChainSolved);
  YGOProMessages.register(YGOProMsgChainEnd);
  YGOProMessages.register(YGOProMsgChainNegated);
  YGOProMessages.register(YGOProMsgChainDisabled);
  YGOProMessages.register(YGOProMsgRandomSelected);
  YGOProMessages.register(YGOProMsgBecomeTarget);
  YGOProMessages.register(YGOProMsgDraw);
  YGOProMessages.register(YGOProMsgDamage);
  YGOProMessages.register(YGOProMsgRecover);
  YGOProMessages.register(YGOProMsgEquip);
  YGOProMessages.register(YGOProMsgUnequip);
  YGOProMessages.register(YGOProMsgLpUpdate);
  YGOProMessages.register(YGOProMsgCardTarget);
  YGOProMessages.register(YGOProMsgCancelTarget);
  YGOProMessages.register(YGOProMsgPayLpCost);
  YGOProMessages.register(YGOProMsgAddCounter);
  YGOProMessages.register(YGOProMsgRemoveCounter);
  YGOProMessages.register(YGOProMsgAttack);
  YGOProMessages.register(YGOProMsgBattle);
  YGOProMessages.register(YGOProMsgAttackDisabled);
  YGOProMessages.register(YGOProMsgDamageStepStart);
  YGOProMessages.register(YGOProMsgDamageStepEnd);
  YGOProMessages.register(YGOProMsgMissedEffect);
  YGOProMessages.register(YGOProMsgTossCoin);
  YGOProMessages.register(YGOProMsgTossDice);
  YGOProMessages.register(YGOProMsgRockPaperScissors);
  YGOProMessages.register(YGOProMsgHandRes);
  YGOProMessages.register(YGOProMsgAnnounceRace);
  YGOProMessages.register(YGOProMsgAnnounceAttrib);
  YGOProMessages.register(YGOProMsgAnnounceCard);
  YGOProMessages.register(YGOProMsgAnnounceNumber);
  YGOProMessages.register(YGOProMsgCardHint);
  YGOProMessages.register(YGOProMsgTagSwap);
  YGOProMessages.register(YGOProMsgPlayerHint);
  YGOProMessages.register(YGOProMsgMatchKill);
  YGOProMessages.register(YGOProMsgResetTime);
  YGOProMessages.register(YGOProMsgUpdateCard);
  YGOProMessages.register(YGOProMsgWaiting);
  YGOProMessages.register(YGOProMsgStart);
  YGOProMessages.register(YGOProMsgUpdateData);
  YGOProMessages.register(YGOProMsgReloadField);
  var YGOProStocGameMsg = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocGameMsg");
    }
    static {
      this.identifier = 1;
    }
    fromPayload(data) {
      this.msg = YGOProMessages.getInstanceFromPayload(data);
      return this;
    }
    toPayload() {
      if (!this.msg) {
        return new Uint8Array(0);
      }
      return this.msg.toPayload();
    }
    fromPartial(data) {
      if (data.msg) {
        this.msg = data.msg.copy();
      }
      return this;
    }
  };
  var YGOProStocErrorMsg = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocErrorMsg");
    }
    static {
      this.identifier = 2;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProStocErrorMsg.prototype, "msg", 2);
  __decorateClass([
    BinaryField("u32", 4)
  ], YGOProStocErrorMsg.prototype, "code", 2);
  var YGOProStocSelectHand = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocSelectHand");
    }
    static {
      this.identifier = 3;
    }
  };
  var YGOProStocSelectTp = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocSelectTp");
    }
    static {
      this.identifier = 4;
    }
  };
  var YGOProStocHandResult = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocHandResult");
    }
    static {
      this.identifier = 5;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProStocHandResult.prototype, "res1", 2);
  __decorateClass([
    BinaryField("u8", 1)
  ], YGOProStocHandResult.prototype, "res2", 2);
  var YGOProStocTpResult = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocTpResult");
    }
    static {
      this.identifier = 6;
    }
  };
  var YGOProStocChangeSide = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocChangeSide");
    }
    static {
      this.identifier = 7;
    }
  };
  var YGOProStocWaitingSide = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocWaitingSide");
    }
    static {
      this.identifier = 8;
    }
  };
  var YGOProStocDeckCount_DeckInfo = class {
    static {
      __name(this, "YGOProStocDeckCount_DeckInfo");
    }
  };
  __decorateClass([
    BinaryField("i16", 0)
  ], YGOProStocDeckCount_DeckInfo.prototype, "main", 2);
  __decorateClass([
    BinaryField("i16", 2)
  ], YGOProStocDeckCount_DeckInfo.prototype, "extra", 2);
  __decorateClass([
    BinaryField("i16", 4)
  ], YGOProStocDeckCount_DeckInfo.prototype, "side", 2);
  var YGOProStocDeckCount = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocDeckCount");
    }
    static {
      this.identifier = 9;
    }
  };
  __decorateClass([
    BinaryField(() => YGOProStocDeckCount_DeckInfo, 0)
  ], YGOProStocDeckCount.prototype, "player0DeckCount", 2);
  __decorateClass([
    BinaryField(() => YGOProStocDeckCount_DeckInfo, 6)
  ], YGOProStocDeckCount.prototype, "player1DeckCount", 2);
  var YGOProStocCreateGame = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocCreateGame");
    }
    static {
      this.identifier = 17;
    }
  };
  __decorateClass([
    BinaryField("u32", 0)
  ], YGOProStocCreateGame.prototype, "gameid", 2);
  var YGOProStocJoinGame = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocJoinGame");
    }
    static {
      this.identifier = 18;
    }
  };
  __decorateClass([
    BinaryField(() => HostInfo, 0)
  ], YGOProStocJoinGame.prototype, "info", 2);
  var YGOProStocTypeChange = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocTypeChange");
    }
    static {
      this.identifier = 19;
    }
    /**
     * Get/Set player position (low 4 bits, 0-7)
     */
    get playerPosition() {
      return this.type & 15;
    }
    set playerPosition(value) {
      this.type = this.type & 240 | value & 15;
    }
    /**
     * Get/Set host flag (high 4 bits)
     * Returns true if this player is the host
     */
    get isHost() {
      return (this.type >> 4 & 15) !== 0;
    }
    set isHost(value) {
      if (value) {
        this.type = this.type & 15 | 16;
      } else {
        this.type = this.type & 15;
      }
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProStocTypeChange.prototype, "type", 2);
  var YGOProStocLeaveGame = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocLeaveGame");
    }
    static {
      this.identifier = 20;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProStocLeaveGame.prototype, "pos", 2);
  var YGOProStocDuelStart = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocDuelStart");
    }
    static {
      this.identifier = 21;
    }
  };
  var YGOProStocDuelEnd = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocDuelEnd");
    }
    static {
      this.identifier = 22;
    }
  };
  var YGOProStocReplay = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocReplay");
    }
    static {
      this.identifier = 23;
    }
    constructor() {
      super();
      this.replay = new YGOProYrp();
    }
    fromPayload(data) {
      this.replay = new YGOProYrp().fromYrp(data);
      return this;
    }
    toPayload() {
      return this.replay.toYrp();
    }
    fromPartial(data) {
      if (data.replay) {
        this.replay = new YGOProYrp(data.replay);
      }
      return this;
    }
    copy() {
      const copied = new this.constructor();
      copied.replay = new YGOProYrp(this.replay);
      return copied;
    }
  };
  var YGOProStocTimeLimit = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocTimeLimit");
    }
    static {
      this.identifier = 24;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProStocTimeLimit.prototype, "player", 2);
  __decorateClass([
    BinaryField("u16", 2)
  ], YGOProStocTimeLimit.prototype, "left_time", 2);
  var STOC_CHAT_MAX_LENGTH = 256;
  var YGOProStocChat = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocChat");
    }
    static {
      this.identifier = 25;
    }
    static {
      this.MAX_LENGTH = STOC_CHAT_MAX_LENGTH;
    }
    constructor() {
      super();
      this.player_type = 0;
      this.msg = "";
    }
    fromPayload(data) {
      if (data.length < 2) {
        throw new Error("STOC_CHAT data too short");
      }
      this.player_type = data[0] | data[1] << 8;
      if (data.length > 2) {
        const decoder = new TextDecoder("utf-16le");
        this.msg = decoder.decode(data.slice(2)).replace(/\0+$/, "");
      } else {
        this.msg = "";
      }
      return this;
    }
    toPayload() {
      const text = this.msg.length > STOC_CHAT_MAX_LENGTH ? this.msg.substring(0, STOC_CHAT_MAX_LENGTH) : this.msg;
      const utf16 = new Uint16Array(text.length + 1);
      for (let i = 0; i < text.length; i++) {
        utf16[i] = text.charCodeAt(i);
      }
      utf16[text.length] = 0;
      const result = new Uint8Array(2 + utf16.byteLength);
      result[0] = this.player_type & 255;
      result[1] = this.player_type >> 8 & 255;
      result.set(new Uint8Array(utf16.buffer), 2);
      return result;
    }
    fromPartial(data) {
      if (data.player_type !== void 0) {
        this.player_type = data.player_type;
      }
      if (data.msg !== void 0) {
        this.msg = data.msg;
      }
      return this;
    }
  };
  var YGOProStocHsPlayerEnter = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocHsPlayerEnter");
    }
    static {
      this.identifier = 32;
    }
    // 1 byte padding (note: actual size is 41 bytes, not 42 - workaround in original code)
  };
  __decorateClass([
    BinaryField("utf16", 0, 20)
  ], YGOProStocHsPlayerEnter.prototype, "name", 2);
  __decorateClass([
    BinaryField("u8", 40)
  ], YGOProStocHsPlayerEnter.prototype, "pos", 2);
  var YGOProStocHsPlayerChange = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocHsPlayerChange");
    }
    static {
      this.identifier = 33;
    }
    /**
     * Get/Set player state (low 4 bits)
     * Can be a PlayerChangeState enum value or a player position (0-7) for position changes
     */
    get playerState() {
      return this.status & 15;
    }
    set playerState(value) {
      this.status = this.status & 240 | value & 15;
    }
    /**
     * Get/Set player position (high 4 bits, 0-3)
     */
    get playerPosition() {
      return this.status >> 4 & 15;
    }
    set playerPosition(value) {
      this.status = this.status & 15 | (value & 15) << 4;
    }
  };
  __decorateClass([
    BinaryField("u8", 0)
  ], YGOProStocHsPlayerChange.prototype, "status", 2);
  var YGOProStocHsWatchChange = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocHsWatchChange");
    }
    static {
      this.identifier = 34;
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProStocHsWatchChange.prototype, "watch_count", 2);
  var YGOProStocTeammateSurrender = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocTeammateSurrender");
    }
    static {
      this.identifier = 35;
    }
  };
  var YGOProStocFieldFinish = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocFieldFinish");
    }
    static {
      this.identifier = 48;
    }
  };
  var SrvproRoomInfo = class {
    static {
      __name(this, "SrvproRoomInfo");
    }
  };
  __decorateClass([
    BinaryField("utf8", 0, 64)
  ], SrvproRoomInfo.prototype, "roomname", 2);
  __decorateClass([
    BinaryField("u8", 64)
  ], SrvproRoomInfo.prototype, "room_status", 2);
  __decorateClass([
    BinaryField("i8", 65)
  ], SrvproRoomInfo.prototype, "room_duel_count", 2);
  __decorateClass([
    BinaryField("i8", 66)
  ], SrvproRoomInfo.prototype, "room_turn_count", 2);
  __decorateClass([
    BinaryField("utf8", 67, 128)
  ], SrvproRoomInfo.prototype, "player1", 2);
  __decorateClass([
    BinaryField("i8", 195)
  ], SrvproRoomInfo.prototype, "player1_score", 2);
  __decorateClass([
    BinaryField("i32", 196)
  ], SrvproRoomInfo.prototype, "player1_lp", 2);
  __decorateClass([
    BinaryField("utf8", 200, 128)
  ], SrvproRoomInfo.prototype, "player2", 2);
  __decorateClass([
    BinaryField("i8", 328)
  ], SrvproRoomInfo.prototype, "player2_score", 2);
  __decorateClass([
    BinaryField("i32", 329)
  ], SrvproRoomInfo.prototype, "player2_lp", 2);
  var YGOProStocSrvproRoomlist = class extends YGOProStocBase {
    static {
      __name(this, "YGOProStocSrvproRoomlist");
    }
    static {
      this.identifier = 49;
    }
  };
  __decorateClass([
    BinaryField("u16", 0)
  ], YGOProStocSrvproRoomlist.prototype, "count", 2);
  __decorateClass([
    BinaryField(() => SrvproRoomInfo, 2, (obj) => obj.count)
  ], YGOProStocSrvproRoomlist.prototype, "rooms", 2);
  var YGOProStoc = new ProtoRegistryBase(YGOProStocBase);
  YGOProStoc.register(YGOProStocGameMsg);
  YGOProStoc.register(YGOProStocErrorMsg);
  YGOProStoc.register(YGOProStocSelectHand);
  YGOProStoc.register(YGOProStocSelectTp);
  YGOProStoc.register(YGOProStocHandResult);
  YGOProStoc.register(YGOProStocTpResult);
  YGOProStoc.register(YGOProStocChangeSide);
  YGOProStoc.register(YGOProStocWaitingSide);
  YGOProStoc.register(YGOProStocDeckCount);
  YGOProStoc.register(YGOProStocCreateGame);
  YGOProStoc.register(YGOProStocJoinGame);
  YGOProStoc.register(YGOProStocTypeChange);
  YGOProStoc.register(YGOProStocLeaveGame);
  YGOProStoc.register(YGOProStocDuelStart);
  YGOProStoc.register(YGOProStocDuelEnd);
  YGOProStoc.register(YGOProStocReplay);
  YGOProStoc.register(YGOProStocTimeLimit);
  YGOProStoc.register(YGOProStocChat);
  YGOProStoc.register(YGOProStocHsPlayerEnter);
  YGOProStoc.register(YGOProStocHsPlayerChange);
  YGOProStoc.register(YGOProStocHsWatchChange);
  YGOProStoc.register(YGOProStocTeammateSurrender);
  YGOProStoc.register(YGOProStocFieldFinish);
  YGOProStoc.register(YGOProStocSrvproRoomlist);

  // frame.mjs
  var MAX_FRAME_BYTES = 64 * 1024;
  var MAX_BUFFER_BYTES = 4 * 1024 * 1024;
  var EMPTY = new Uint8Array(0);
  var ProtocolError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ProtocolError";
    }
  };
  function concat(a, b) {
    if (a.length === 0) return b;
    if (b.length === 0) return a;
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }
  function encodeFrame(payload) {
    const len = payload.length;
    if (len < 1) {
      throw new ProtocolError("payload \u81F3\u5C11\u9700\u8981 1 \u5B57\u8282\uFF08identifier\uFF09");
    }
    if (len > MAX_FRAME_BYTES) {
      throw new ProtocolError(`\u5E27\u8FC7\u5927\uFF1A${len} > ${MAX_FRAME_BYTES}`);
    }
    const out = new Uint8Array(2 + len);
    new DataView(out.buffer).setUint16(0, len, true);
    out.set(payload, 2);
    return out;
  }
  function frameLength(frame) {
    return new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint16(0, true);
  }
  function framePayload(frame) {
    return frame.subarray(2);
  }
  var FrameScanner = class {
    /** @type {Uint8Array} */
    #acc = EMPTY;
    #skipBytes = 0;
    #maxFrameBytes;
    #maxBufferBytes;
    #onError;
    constructor(options = {}) {
      this.#maxFrameBytes = options.maxFrameBytes ?? MAX_FRAME_BYTES;
      this.#maxBufferBytes = options.maxBufferBytes ?? MAX_BUFFER_BYTES;
      this.#onError = options.onError ?? (() => {
      });
    }
    /** 当前还留在缓冲里、尚未凑成一整帧的字节数。 */
    get bufferedBytes() {
      return this.#acc.length;
    }
    /** 丢弃缓冲（断线重连时必须调用）。 */
    reset() {
      this.#acc = EMPTY;
      this.#skipBytes = 0;
    }
    #error(message) {
      this.#onError(new ProtocolError(message));
    }
    /**
     * 喂入一段字节，返回本轮能完整解出的帧数组。
     * @param {Uint8Array|null|undefined} chunk
     * @returns {Uint8Array[]}
     */
    push(chunk) {
      let acc = !chunk || chunk.length === 0 ? this.#acc : concat(this.#acc, chunk);
      const out = [];
      if (acc.length > this.#maxBufferBytes) {
        this.#error(`\u7F13\u51B2\u6EA2\u51FA\uFF1A\u7D2F\u79EF ${acc.length} \u5B57\u8282 > ${this.#maxBufferBytes}`);
        this.#acc = EMPTY;
        return out;
      }
      while (acc.length >= 3) {
        if (this.#skipBytes > 0) {
          if (acc.length < this.#skipBytes) {
            this.#skipBytes -= acc.length;
            acc = EMPTY;
            break;
          }
          acc = acc.subarray(this.#skipBytes);
          this.#skipBytes = 0;
          continue;
        }
        const len = new DataView(acc.buffer, acc.byteOffset, acc.byteLength).getUint16(0, true);
        if (len < 1) {
          acc = acc.subarray(2);
          continue;
        }
        const total = 2 + len;
        if (total > this.#maxFrameBytes) {
          this.#error(`\u5E27\u957F ${total} \u8D85\u8FC7\u4E0A\u9650 ${this.#maxFrameBytes}\uFF0C\u8DF3\u8FC7\u8BE5\u5E27`);
          this.#skipBytes += total;
          continue;
        }
        if (acc.length < total) break;
        out.push(acc.subarray(0, total));
        acc = acc.subarray(total);
      }
      this.#acc = acc;
      return out;
    }
  };

  // envelope.mjs
  var HINT_TYPE = {
    1: "\u4E8B\u4EF6",
    2: "\u6D88\u606F",
    3: "\u9009\u62E9\u63D0\u793A",
    4: "\u5BF9\u624B\u5DF2\u9009",
    5: "\u6548\u679C",
    6: "\u79CD\u65CF",
    7: "\u5C5E\u6027",
    8: "\u5361\u53F7",
    9: "\u6570\u5B57",
    10: "\u5361",
    11: "\u533A\u57DF"
  };
  var TABLE = {
    4: ["Start", () => ({})],
    5: ["Win", (m) => ({ player: m.player })],
    2: ["Hint", (m) => ({ hint: (HINT_TYPE[m.type] || "HINT#" + m.type) + " = " + m.desc, desc: m.desc, type: m.type })],
    // ⚠⚠ 关键：**必须把原始 hex 传给查看器**。
    //   `ygopro-msg-encode` **不解析** UpdateData 里每张卡的数值（全库只有 Battle_CardStats 有 atk ✗），
    //   所以下面 raw 里的 atk/def/level/type 全是 undefined ✗（实测日志：`a?/d?/L?/t?`）。
    //   查看器的 ingestUpdateDataStats() 是**自己按真实布局解析 hex** 才能拿到攻守/等级/类型 ✓
    //   （官网查看器也是这么做的）。不传 hex 的后果：等级、攻击力（含持续效果加成 ——
    //   如 强袭黑羽·泪雨之千鸟刀鸟 的"墓地「黑羽」数量×300" ✗）、"当作调整"全部只显示基础值。
    6: ["UpdateData", (m, inner) => ({
      player: m.player,
      location: m.location,
      // ⚠ 用纯 JS 转 hex：浏览器包里**没有 Buffer** ✗（用 Buffer.from 会抛异常，被这里的 try/catch 吞掉 →
      //   整条 UpdateData 字段全丢，比不传更糟）。
      hex: (() => {
        if (!inner || !inner.length) return void 0;
        let s = "";
        for (let i = 0; i < inner.length; i++) s += (inner[i] < 16 ? "0" : "") + inner[i].toString(16);
        return s;
      })(),
      // 卡号数组（查看器要这个形状）
      cards: (m.cards || []).map((c) => c.code),
      // 原始 query 列表（带 position/reveal，重连快照靠它把卡摆对）
      raw: (m.cards || []).map((c) => ({
        code: c.code,
        position: c.position,
        reveal: c.reveal,
        controller: c.controller,
        location: c.location,
        sequence: c.sequence
      }))
    })],
    33: ["ShuffleHand", (m) => ({ player: m.player, cards: m.cards })],
    // 卡组翻转（天变地异）：翻转时服务端紧接着发 MSG_DECK_TOP 告知**卡组顶端的卡号**
    37: ["ReverseDeck", () => ({})],
    38: ["DeckTop", (m) => ({ player: m.player, sequence: m.sequence, code: m.code >>> 0 & 2147483647, faceDown: m.code >>> 0 >= 2147483648 })],
    40: ["NewTurn", (m) => ({ player: m.player })],
    41: ["NewPhase", (m) => ({ phase: m.phase })],
    50: ["Move", (m) => ({ code: m.code, previous: m.previous, current: m.current })],
    // PosChange：真实数据在 m.cardInfo 里，必须**摊平**带出 controller/location/sequence ——
    //   ⚠ 不带的话动画只能退化成"我方怪兽区 seq0"，表现是"不管翻哪张，动画都演在同一只怪身上"（玩家实测）
    // ⚠ 字段从**原始 hex** 解（查看器也是这么做的）：库的 cardInfo 并不存在 ✗
    //   布局：[0]=id [1..4]=code(le) [5]=controller [6]=location [7]=sequence [8]=previousPosition [9]=currentPosition
    53: ["PosChange", (m, inner) => {
      const b = inner || [];
      return {
        code: (b[1] | b[2] << 8 | b[3] << 16 | b[4] << 24) >>> 0,
        controller: b[5],
        location: b[6],
        sequence: b[7],
        previousPosition: b[8],
        currentPosition: b[9]
      };
    }],
    60: ["Summoning", (m) => ({ code: m.code, controller: m.controller })],
    61: ["Summoned", () => ({})],
    62: ["SpSummoning", (m) => ({ code: m.code })],
    63: ["Summoned", () => ({})],
    64: ["Summoning", (m) => ({ code: m.code, controller: m.controller })],
    65: ["Summoned", () => ({})],
    70: ["Chaining", (m) => ({ code: m.code, controller: m.controller, location: m.location, sequence: m.sequence })],
    72: ["ChainSolving", () => ({})],
    73: ["ChainSolved", () => ({})],
    74: ["ChainEnd", () => ({})],
    90: ["Draw", (m) => ({ player: m.player, cards: m.cards, count: m.count })],
    91: ["Damage", (m) => ({ player: m.player, value: m.value })],
    92: ["Recover", (m) => ({ player: m.player, value: m.value })],
    94: ["LpUpdate", (m) => ({ player: m.player, lp: m.lp })],
    100: ["PayLpCost", (m) => ({ player: m.player, value: m.cost })],
    110: ["Attack", (m) => ({ attacker: m.attacker })],
    113: ["DamageStepStart", () => ({})],
    114: ["DamageStepEnd", () => ({})],
    130: ["Toss", (m) => ({ player: m.player })],
    131: ["Toss", (m) => ({ player: m.player })],
    132: ["RockPaperScissors", (m) => ({ player: m.player })],
    // ── 以下查看器只有日志分支，但仍然要转发，好让右侧日志有"谁被问了什么" ──
    10: ["SelectBattleCmd", () => ({})],
    11: ["SelectIdleCmd", () => ({})],
    12: ["SelectEffectYn", () => ({})],
    13: ["SelectEffectYn", () => ({})],
    14: ["SelectOption", () => ({})],
    15: ["SelectCard", () => ({})],
    16: ["SelectChain", () => ({})],
    18: ["SelectPlace", () => ({})],
    19: ["SelectPosition", () => ({})],
    20: ["SelectTribute", () => ({})],
    23: ["SelectSum", () => ({})],
    24: ["SelectPlace", () => ({})],
    26: ["SelectUnselectCard", () => ({})],
    30: ["ConfirmCards", () => ({})],
    31: ["ConfirmCards", () => ({})],
    140: ["AnnounceRace", () => ({})],
    141: ["AnnounceAttrib", () => ({})],
    142: ["AnnounceCard", () => ({})],
    143: ["AnnounceNumber", () => ({})]
  };
  var toHex = (u8) => {
    let s = "";
    for (const b of u8) s += b.toString(16).padStart(2, "0");
    return s;
  };
  function toEnvelope(msg, inner) {
    if (!msg) return null;
    const entry = TABLE[msg.identifier];
    if (!entry) return null;
    const [name, build] = entry;
    let f = {};
    try {
      f = build(msg, inner) || {};
    } catch {
      f = {};
    }
    let hex;
    try {
      hex = inner && inner.length ? toHex(inner) : void 0;
    } catch {
      hex = void 0;
    }
    return { name, f, hex };
  }
  var ENVELOPE_IDS = Object.keys(TABLE).map(Number);
  function isMapped(identifier) {
    return Object.prototype.hasOwnProperty.call(TABLE, identifier);
  }
  return __toCommonJS(entry_browser_exports);
})();
/*! Bundled license information:

@cjser/lzma1/lib/index.js:
  (**
   * @license
   * Copyright Filip Seman
   * SPDX-License-Identifier: MIT
   *)
*/
