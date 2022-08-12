const ES_GLOBAL = globalThis;

// import ES built-ins

const {
 Reflect,
 Error,
 TypeError,
 RangeError,
 Proxy,
 Array,
 Boolean,
 Number,
 String,
 Symbol,
 BigInt,
 Object,
 WeakMap,
 undefined: UNDEFINED
} = ES_GLOBAL;

const NULL = null;

const {
 get: reflect_get,
 apply: reflect_apply,
 has: reflect_has,
 getOwnPropertyDescriptor: reflect_get_own_property_descriptor,
 setPrototypeOf: reflect_set_prototype_of,
 getPrototypeOf: reflect_get_prototype_of,
 construct: reflect_construct
} = Reflect;

// Important Note!
// {Reflect::construct}'s second argument is an array-like object, not just an array!
// Do not pass {Array} objects that have holes, whose prototype is the global {Array.prototype}, as prototype manipulation would be observable here!

const {
 freeze: object_freeze,
 defineProperty: object_define_property
} = Object;

// In case I made any mistakes, but also used on consumer objects in type checking
const is_callable = v => "function" === typeof v;

// {object_to_string} is declared later

// throws + side-effects
const assert_is_callable = fn => {
 // If IsCallable(fn) is false, throw a TypeError exception.
 if ( !is_callable(fn) ) {
  // FIXME?: consider that {Object#toString} can throw
  const name = object_to_string(fn);

  const error_message = `${name} is not a function`;

  throw new TypeError(error_message);
 }
};

// turns object methods into functions that can be applied to anything
// make_applier(T (Self::*fn)(...Arguments)) -> T (Self&, ...Arguments)
const make_applier = fn => {
 assert_is_callable(fn);

 // TODO should this use {new Function} to encourage JiT compilation of the callback?

 // [&fn]
 return (self, ...args) => reflect_apply(fn, self, args);
};

// this is wrapped at the end
const OBJECT_PROTOTYPE = Object.prototype;

// throws + has side-effects
const object_to_string = make_applier(
 OBJECT_PROTOTYPE.toString
);

const object_has_own_property = Object.hasOwn ?? make_applier(
 OBJECT_PROTOTYPE.hasOwnProperty
);

// TODO: consider {Symbol#toString} vs {Symbol#description},
// what difference is there?
const symbol_to_string = make_applier(
 Symbol.prototype.toString
);

const WEAK_MAP_PROTOTYPE = WeakMap.prototype;

const weak_map_set = make_applier(
 WEAK_MAP_PROTOTYPE.set
);

const weak_map_get = make_applier(
 WEAK_MAP_PROTOTYPE.get
);

// wraps a value as an object data descriptor
const to_descriptor_wec = (
 value,
 w_e_c // descriptor as a bitset
) => {
 w_e_c &= 0b111;

 const writable = 1 === 1 & (w_e_c >>> 2);
 const enumerable = 1 === 1 & (w_e_c >>> 1);
 const configurable = 1 === 1 & (w_e_c >>> 0);

 return {
  __proto__: NULL,
  value,
  writable,
  enumerable,
  configurable
 }
};

// these classes use returns with static {Reflect::construct} calls,
// because {super(...)} uses prototype lookup, which can be mutated at runtime

// error_class#name = error_class.name;
const write_error_class_name_property = error_class => {
 object_define_property(
  error_class.prototype,
  "name",
  to_descriptor_wec(
   error_class.name,
   0b101
  )
 );
};

// primary exception thrown by the public interface
const {
 KeyError,
 InternalKeyError
} = (() => {
 // TODO: use private properties and the super return trick after the static reflect construct lookup
 const KeyError = function KeyError(
  missing_property
  // TODO: should the options parameter be supported? Why? Why not?
 ) {
  const property_as_string = property_to_maybe_string(missing_property);

  if ( NULL !== property_as_string ) {
   const constructor_arguments = [property_as_string];

   const self = reflect_construct(
    RangeError,
    constructor_arguments,
    // only nullish when called as a function, otherwise is called as a proper Constructor function
    new.target ?? KeyError
   );

   weak_map_set(key, self, missing_property);
   return self;
  } else {
   throw new TypeError("argument received isn't a valid PropertyKey");
  }
 };

 const InternalKeyError = class KeyError extends RangeError {
  get key() {
   const maybe_key = weak_map_get(key, this);
   if ( UNDEFINED !== maybe_key ) {
    return maybe_key;
   } else {
    // private data wasn't found; user probably did {Reflect.getOwnPropertyDescriptor(KeyError.prototype, "key").call(x)}
    // [[key]] only exists on authentic instances of {KeyError}
    throw new TypeError(
      // TODO: Should the error message strings all be hoisted to prevent reallocation?
      // The "KeyError" text can be sliced out of this for usage elsewhere, e.g. where {KeyError.name} is currently used, and as the functiom's {.name}. Could such an idea improve caching, and allow the other allocations to be freed?
     `"get key" called on an object that does not implement interface KeyError.`
    );
   }
  }

  constructor(
   missing_property
  ) {
   // Internal construction fastpath
   // Thia is internal, as the prototype's {.constructor} is overwritten, thus this class is never exposed to the user
   // Copy of {KeyError} body, without the extra input validation error branch
   // TODO: should {KeyError} call into {InternalKeyError}?
   const property_as_string = property_to_string(missing_property);

   const constructor_arguments = [property_as_string];

   const self = reflect_construct(
    RangeError,
    constructor_arguments,
    new.target
   );

   weak_map_set(key, self, missing_property);

   return self;
  }
 };

 const { prototype } = InternalKeyError;

 // [[key]]: String | Symbol | Null
 // KeyError.prototype[[key]] = null;
 const key = new WeakMap([
  [prototype, NULL]
 ]);

 {
  // InternalKeyError#constructor = KeyError;
  object_define_property(
   prototype,
   "constructor",
   to_descriptor_wec(
    KeyError,
    0b101
   )
  );

  // KeyError.prototype = InternalKeyError.prototype;
  object_define_property(
   KeyError,
   "prototype",
   to_descriptor_wec(
    prototype,
    0b000
   )
  );

  // KeyError#name = "KeyError";
  object_define_property(
   prototype,
   "name",
   to_descriptor_wec(
    KeyError.name,
    0b101
   )
  );

  // KeyError[[Prototype]] = RangeError;
  reflect_set_prototype_of(KeyError, RangeError);
 }

 return {
  __proto__: NULL,
  KeyError,
  InternalKeyError
 };
})();

// an error class for internal usage
const InternalError = (() => {
 const InternalError = class InternalError extends Error {
  constructor(
   constructor_arguments
  ) {
   return reflect_construct(
    Error,
    constructor_arguments,
    new.target
   );
  }
 };

 write_error_class_name_property(InternalError);

 return InternalError;
})();

// this function's callsites are logically impossible to reach;
// they should be safe to wipe and treeshake,
// eliminating {InternalError} as a dependency, and this function.
// Although, one may actually mess around in a developer tools console or something of the sort,
// actually access an internal function, and attempt calling it,
// so these may serve some use, should that situation ever arise
const unreachable = () => {
 throw new InternalError("unreachable", UNDEFINED);
};

const property_to_maybe_string = property => {
 switch (typeof property) {
  case "string": {
   return `"${property}"`;
  }
  case "symbol": {
   return symbol_to_string(property);
  }
  default: {
   return NULL;
  }
 }
};

// real object property keys can't be anything else, as of ES11,
// so, as this is an internal function, it is erroneous to let anything else reach this point
const property_to_string = property =>
 property_to_maybe_string(property) ?? unreachable();

const EMPTY_ARGUMENTS = object_freeze([]);

const apply_this = (fn, self) =>
 reflect_apply(fn, self, EMPTY_ARGUMENTS);

// includes the passed argument when iterating
const prototype_iterator = function *(reciever) {
 for (
  let current_target = reciever;
  UNDEFINED !== current_target;
  current_target = reflect_get_prototype_of(current_target)
 ) {
  // yield next prototype in the prototype chain
  yield current_target;
 }
}

// reads through the prototype chain until s *specific* target prototype is encountered

// throws + has side-effects (triggers proxy interceptions and calls getters/setters)
const get_until_prototype = (reciever, property, target_prototype) => {
 for (
  const current_target of prototype_iterator(reciever)
 ) {
  const descriptor = reflect_get_own_property_descriptor(current_target, property);

  if ( UNDEFINED !== descriptor ) {
   if ( object_has_own_property(descriptor, "get") ) {
    const getter = descriptor.get;
    // {.get} & {.set} can be undefined!
    // FIXME: check actual spec to mirror the behaviour correctly

    return apply_this(getter, current_target);
   } else if ( object_has_own_property(descriptor, "set") ) {
    // welp, there's *something* here, so stop here?
    return UNDEFINED;
   } else if ( object_has_own_property(descriptor, "value") ) {
    const value = descriptor.value;

    return value;
   } else {
    // as of ES11, nothing else is possible
    unreachable();
   }
  } else {
   // the property key isn't in the object
   return UNDEFINED;
  }
 }

 return UNDEFINED;
};

// use of {__proto__} like this is fine; see the merged PR: <https://github.oom/tc39/ecma262/pull/2125>

const PROXY_HANDLER = object_freeze({
 __proto__: NULL,
 get: (target, property, receiver) => {
  // FIXME: does {Reflect::has} cause side-effects?
  // if so, can I make a single function that yields a tuple of [had, value],
  // which wouldn't duplicate consumer code side-effects?
  if ( reflect_has(target, property, receiver) ) {
   return reflect_get(target, property, receiver);
  } else {
   throw new InternalKeyError(property);
  }
 }
});

/*
fn make_proxied_prototype_class<Prototype, Class>(
 target_prototype: Prototype,
 class_creator_callback: (proxied_target_prototype: Proxy<Prototype>) -> Class
) -> Class;
*/
// the callback must yield a function {<Class>}, which is responsible for returning an appropriate value when {StaticClass} is called as a function, as opposed to when called as a constructor. Callling as a constructor should yield {undefined}, and be left to the parent to handle, usually (?)
const make_proxied_prototype_class = (
 target_prototype,
 class_creator_callback
) => {
 const proxied_target_prototype = new Proxy(
  target_prototype,
  PROXY_HANDLER
 );

 const StaticClass = class_creator_callback(
  proxied_target_prototype
 );

 object_define_property(
  StaticClass,
  "prototype",
  to_descriptor_wec(
   proxied_target_prototype,
   0b000
  )
 );

 return StaticClass;
};

// FIXME: yhese primitive wrappers totally don't work, I expect that it's impossible to do this correctly

// e.g. {new StaticNumber(0.0).valueOf()} throws because the method target is a weird object with the proxied prototype, constructed from a user function, as opposed to the built-in {Nunber}

const StaticBoolean = make_proxied_prototype_class(
 Boolean.prototype,
 PROXIED_BOOLEAN_PROTOTYPE => function StaticBoolean(value) {
  if ( UNDEFINED === new.target ) {
   return Boolean(value);
  }
 }
);

const StaticNumber = make_proxied_prototype_class(
 Number.prototype,
 PROXIED_NUMBER_PROTOTYPE => function StaticNumber(value) {
  if ( UNDEFINED === new.target ) {
   return Number(value);
  }
 }
);

const StaticString = make_proxied_prototype_class(
 String.prototype,
 PROXIED_STRING_PROTOTYPE => function StaticString(value) {
  if ( UNDEFINED === new.target ) {
   return String(value);
  }
 }
);

const todo = () => {
 throw new Error("Not implemented");
};

// class StaticObject : Proxy<Window::Object>;
const StaticObject = make_proxied_prototype_class(
 OBJECT_PROTOTYPE,
 PROXIED_OBJECT_PROTOTYPE => function StaticObject(value) {
  // null === new.target || StaticObject === new.target
  // new.target && StaticObject === new.target
  if ( StaticObject === (new.target ?? StaticObject) ) {
   // new? StaticObject(value?);

   // TODO: determine performance characteristics of {(typeof argument).slice(0, 3)}, then matching against only the first three characters of everything, or possibly hashing as an integer, or both
   switch (typeof argument) {
    case "undefined":
    case "null": {
     return {
      __proto__: PROXIED_OBJECT_PROTOTYPE
     }
    }
    case "boolean": {
     return new StaticBoolean(value);
    }
    case "number": {
     return new StaticNumber(value);
    }
    case "string": {
     return new StaticString(value);
    }
    // TODO: how can these be implemented?
    case "symbol": {
     todo();
     // return new StaticSymbol(value);
    }
    case "bigint": {
     todo();
     // return new StaticBigInt(value);
    }
    case "object": {
     return argument;
    }
   }
  }

  // new StaticObject();
  // otherwise the ES engine will look up the prototype to find {PROXIED_OBJECT_PROTOTYPE} and construct from that
 }
);

const StaticArray = make_proxied_prototype_class(
 Array.prototype,
 PROXIED_ARRAY_PROTOTYPE => function StaticArray() {
  if ( UNDEFINED === new.target ) {
   // StaticArray();
   return object_set_prototype_of([], PROXIED_ARRAY_PROTOTYPE);

   // TODO: missing implementations when called as a function, given arguments!
  }

  // new StaticArray();
  // otherwise the ES engine will look up the prototype to find {PROXIED_ARRAY_PROTOTYPE} and construct from that
  // TODO: impl Array static methods
 }
);

export {
 StaticBoolean,
 StaticNumber,
 StaticString,
 // StaticSymbol,
 // StaticBigInt,
 StaticObject,
 StaticArray
};

export default KeyError;