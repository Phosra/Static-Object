# Static Object
A JavaScript class that throws exceptions upon accessing missing properties.

The situation was that someone had asked whether it's possible to have JavaScript objects throw an exception if the property is missing, as occurs in Python, among other languages. The solution is `Proxy`, but on its own, there will be a performance reduction. Instead, one may have the proxy object that throws, stored as the object's prototype.

This way, accesses on the object or its prototypes should still be at normal speed (ideally), but the nonexistent properties forward to the proxy.

`StaticObject` is a function or constructor, that returns an object whose prototype is `StaticObject.prototype`, which is a proxy around `Object.prototype`, for which missing accesses throw a `KeyError`.

`KeyError` provides an accessor `key` that stores the key that was not present.

See [main.mjs](/main.mjs) for example usage.
 