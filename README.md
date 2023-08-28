# SML-IO

## About this package

This package is the **Node.js-specific part** mentioned in the environment-independent **[SML](https://www.npmjs.com/package/@stenway/sml)** package (You will find more information there about SML in general). This package uses Node.js's **file system module** and offers simple classes to load and save SML files. It offers stream reader and writer classes to read and write SML files node-by-node.

If you want to get a first impression on how to use this package, you can watch [this video](https://www.youtube.com/watch?v=zrjmOUkrDhE). But always check the changelog of the presented packages for possible changes, that are
not reflected in the video.

## Getting started

First get the **SML-IO package** installed with a package manager of your choice.
If you are using NPM just run the following command:

```
npm install @stenway/sml-io
```

We are going to use the SML-IO package to write and read some
SML files. For that we import the SmlFile class from the SML-IO package.
We take this example, parse it as an SmlDocument and save it as
a file with the static method saveSync of the SmlFile class.

```ts
import { SmlDocument } from "@stenway/sml"
import { SmlFile } from "@stenway/sml-io"

const content = `PointOfInterest
  City      Seattle
  Name      "Space Needle"
  GpsCoords 47.6205 -122.3493
  # Opening hours should go here
End`

const document = SmlDocument.parse(content)
SmlFile.saveSync(document, "Test.sml")
```
After running the example, the file will be written.
It uses the default ReliableTXT encoding UTF-8.
If we want to change the used encoding, we can simply set
the encoding property of the SmlDocument object. Here
we switch to the UTF-16 encoding, and save the document as
another file. Note that you need to import the ReliableTxtEncoding
enum from the [ReliableTXT package](https://www.npmjs.com/package/@stenway/reliabletxt).

```ts
document.encoding = ReliableTxtEncoding.Utf16
SmlFile.saveSync(document, "TestUtf16.sml")
```

The file will be written with the UTF-16 encoding.

Now let's load these files again, with the static method
loadSync of the SmlFile class. We can see that the encoding
of the first file was correctly detected. As well as for the
second file.

```ts
const loadedDocument = SmlFile.loadSync("Test.sml")
console.log(loadedDocument.encoding)

const loadedDocumentUtf16 = SmlFile.loadSync("TestUtf16.sml")
console.log(loadedDocumentUtf16.encoding)
```

### Errors

When we load a file, there are several things that can go
wrong. We'll now have a look at some of the SML-related
error types. The first scenario is
where the SML file does not have a valid preamble and will
throw a ReliableTXT related error. To test that, we can remove
the UTF-8 BOM from the file, by saving it as UTF-8 file without
the BOM in a text editor that supports this functionality.

When the [byte order mark](https://www.youtube.com/watch?v=mujA0AfKgKw) is gone
and we load the file, a NoReliableTxtPreambleError will be thrown and the
loading of the file will be aborted. Switching back the encoding
to UTF-8 with the byte order mark again, the file
will loaded without any error.

The next scenario would be to remove one of the enclosing doublequotes
from the name value, which would will lead to a WsvParserError.

And finally we can produce an SmlParserError, by removing the 
end keyword on the last line.

And this way, we can more precisely detected, what was going
wrong.

### Big SML files

Concerning big SML files, you can watch the [ReliableTXT NPM package video](https://youtu.be/a7dLaMv6F7Y?si=YA5pHgwcdS5GFu9B&t=701) that illustrates the problem of string and file size limits of V8
and Node.js, or read the part about big WSV files in the [WSV package documentation](https://www.npmjs.com/package/@stenway/wsv). This limitation leads to certain restrictions when it comes to writing
and reading bigger files in one take. The SML IO package 
uses the WSV IO package and thus the ReliableTXT IO package
so the same limits apply here as well, concerning the saveSync 
and loadSync method. The limits also might vary between Node.js versions.

With version 20 of Node.js you can say roughly, a 500MB SML file can be written and read in one take,
but if you need bigger files you should use the stream writer and
reader classes.

### Streaming classes

We'll now have a look the synchronous SmlStreamWriter
class. We first need an SmlDocument object as template, which
contains information about the name of the root element, or
indentation settings, or the end keyword. We then create a
SyncSmlStreamWriter object by passing the template document
and the file path as arguments.

```ts
import { SmlDocument, SmlElement } from "@stenway/sml"
import { SyncSmlStreamWriter } from "@stenway/sml-io"

const template = new SmlDocument(new SmlElement("POIs"))
const writer = SyncSmlStreamWriter.create(template, "Stream.sml")
try {
	for (let i=0; i<100; i++) {
		const element = new SmlElement("POI")
		element.addAttribute("Name", [`Point of Interest ${i+1}`])
		element.addAttribute("GpsCoords", [`${i+1}`, i.toString()])
		writer.writeNode(element)
	}
} finally {
	writer.close()
}
```

We iterate a hundred times and write an element with two
attributes, which we will vary by using the iterator variable
to create different values. We use the writeNode method of
the writer class to write the element to the stream. After
the iteration we close the stream writer.

In order to append SML nodes to an existing SML file, we can
create a stream writer in append mode. Here we first append
an empty line with a comment and then append 10 attributes.

```ts
const appendingWriter = SyncSmlStreamWriter.create(template, "Stream.sml", WriterMode.CreateOrAppend)
try {
	appendingWriter.writeNode(new SmlEmptyNode(null, " And now some attributes"))
	for (let i=0; i<10; i++) {
		appendingWriter.writeNode(
			new SmlAttribute("POI", [`Point of Interest ${i+1}`, `${i+1}`, i.toString()])
		)
	}
} finally {
	appendingWriter.close()
}
```
Note that the WriterMode enum needs to be imported from the ReliableTXT package.

And now we want to test the synchronous SmlStreamReader.
For that we create a new reader object by passing the file path
to the constructor. To test, if we are loading an SML file
with the correct format, we do a preliminary check of the root
element's name with the assureName method.

```ts
const reader = SyncSmlStreamReader.create("Stream.sml")
try {
	reader.root.assureName("POIs")
	let numElements = 0
	let numAttributes = 0
	let numEmptyNodes = 0
	while (true) {
		const node = reader.readNode()
		if (node === null) { break }
		if (node.isElement()) { numElements++ }
		else if (node.isAttribute()) { numAttributes++ }
		else { numEmptyNodes++ }
	}
	console.log(`Elements: ${numElements} Attributes: ${numAttributes} Empty: ${numEmptyNodes}`)
} finally {
	reader.close()
}
```
We then loop over the file and retrieve
the next node with the readNode method. When the file end was
reached, the method will return null and we can exit our loop.
The read node can be an element, an attribute or an empty line.
In this example we will simply count these three types, and should
get values that match what we were writing before.

And if we run the example, we will see, it counted correctly
100 elements, 10 attributes, and one single comment line.

## Asynchronous IO

All methods and classes come as synchronous and asynchronous versions.
The saveSync and loadSync methods for example are synchronous, and
the save and load methods of the SmlFile class are asynchronous:

```ts
const document = SmlDocument.parse("Root\nEnd")
await SmlFile.save(document, "Test.sml")
const loadedDocument = await SmlFile.load("Test.sml")
```
An asynchronous stream reader for example can be created analogously to
the synchronous variant:

```ts
const reader = await SmlStreamReader.create("Stream.sml")
```

## BinarySML Files
BinarySML is the binary representation of SML documents. It starts with the magic code 'BS1'.
BinarySML is made for scenarios, where parsing speed of the textual representation might be a limitation.
You can learn more about it in the [SML package documentation](https://www.npmjs.com/package/@stenway/sml).

To save and load BinarySML files simply use the BinarySmlFile class.

```ts
const document = SmlDocument.parse("Root\nEnd")
BinarySmlFile.saveSync(document, "Test.bsml")
const loadedDocument = BinarySmlFile.loadSync("Test.bsml")
```

SML files are suited to append content to them. BinarySML files however have an advantage when
appending nodes, because in contrary to the textual version, the end part does not need
to be truncated and thus content can directly be appended.

To read and write BinarySML files in a node-by-node fashion, simply use
the SyncBinaryWsvStreamReader, BinaryWsvStreamReader, SyncBinaryWsvStreamWriter, and
BinaryWsvStreamWriter classes, which work analogously to their textual
version counterparts.