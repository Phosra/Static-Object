import { StaticArray, StaticObject } from "./static-object.mjs";

function printProperties(object) {
  console.log("x: %O, y: %O", object.x, object.y);
  try {
    console.log("z: %O", object.z);
  } catch (error) {
    console.error(error);
  }
}

{
  const object = {
    __proto__: StaticObject.prototype,
    x: NaN,
    y: 9.0,
  };

  printProperties(object);
}

{
  class Point extends StaticObject {
    constructor(x = 0.0, y = 0.0) {
      super();
      this.x = x;
      this.y = y;
    }
  }

  printProperties(new Point(NaN, 9.0));
}

// acts like {Object}

console.log(
 new Object(),
 new StaticObject()
);

console.log(
 Object(),
 StaticObject()
);

console.log(
 Object() === Object(),
 StaticObject() === StaticObject()
);

console.log(
 new Object() === new Object(),
 new StaticObject() === new StaticObject()
);

const array = StaticArray();
array.push(123);
console.log(array[0]);
console.log(array);

array[1];