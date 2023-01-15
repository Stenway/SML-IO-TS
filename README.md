# SML-IO

## About

[SML Documentation/Specification](https://www.simpleml.com)

## Installation

Using NPM:
```
npm install @stenway/sml-io
```

## Getting started

```ts
import { SmlDocument } from "@stenway/sml"
import { SmlFile } from "@stenway/sml-io"

let filePath = "Test.sml"
SmlFile.saveSync(SmlDocument.parse("Begin\n\tAttribute 123 #Comment\nEnd"), filePath)
console.log(SmlFile.loadSync(filePath))
```

## Videos
* [Package Usage](https://www.youtube.com/watch?v=zrjmOUkrDhE)
* [SML in 60 seconds](https://www.youtube.com/watch?v=qOooyygwX0w)
* [SML Explained](https://www.youtube.com/watch?v=fBzMdzMtH-s)
* [Why I like the UTF-8 Byte Order Mark (BOM)](https://www.youtube.com/watch?v=VgVkod9HQTo)
* [Stop Using Windows Line Breaks (CRLF)](https://www.youtube.com/watch?v=YPtMCiHj7F8)

## Examples

```ts
import { ReliableTxtEncoding } from "@stenway/reliabletxt"
import { SmlDocument } from "@stenway/sml"
import { SmlFile } from "@stenway/sml-io"

// saving

let content = `PointOfInterest
  City      Seattle
  Name      "Space Needle"
  GpsCoords 47.6205 -122.3493
  # Opening hours should go here
End`

let document = SmlDocument.parse(content)
SmlFile.saveSync(document, "Test.sml")

document.encoding = ReliableTxtEncoding.Utf16
SmlFile.saveSync(document, "TestUtf16.sml")

// loading

console.log("----------------------------------------")

let loadedDocument = SmlFile.loadSync("Test.sml")
console.log(loadedDocument.toString())

console.log("----------------------------------------")

let loadedDocumentUtf16 = SmlFile.loadSync("TestUtf16.sml")
console.log(loadedDocumentUtf16.toString())

console.log("----------------------------------------")
console.log("SML-IO usage")
```

```ts
import { ReliableTxtEncoding } from "@stenway/reliabletxt"
import { SmlDocument, SmlElement, SmlAttribute, SmlEmptyNode } from "@stenway/sml"
import { SyncSmlStreamReader, SyncSmlStreamWriter } from "@stenway/sml-io"

// writing

let template = new SmlDocument(new SmlElement("POIs"))
let writer = new SyncSmlStreamWriter(template, "Stream.sml")
try {
	for (let i=0; i<100; i++) {
		let element = new SmlElement("POI")
		element.addAttribute("Name", [`Point of Interest ${i+1}`])
		element.addAttribute("GpsCoords", [`${i+1}`, i.toString()])
		writer.writeNode(element)
	}
} finally {
	writer.close()
}

// appending

let appendingWriter = new SyncSmlStreamWriter(
	template, "Stream.sml", true, true
)
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

// reading

let reader = new SyncSmlStreamReader("Stream.sml")
try {
	reader.root.assureName("POIs")
	let numElements = 0
	let numAttributes = 0
	let numEmptyNodes = 0
	while (true) {
		let node = reader.readNode()
		if (node === null) { break }
		if (node.isElement()) { numElements++ }
		else if (node.isAttribute()) { numAttributes++ }
		else { numEmptyNodes++ }
	}
	console.log(`Elements: ${numElements} Attributes: ${numAttributes} Empty: ${numEmptyNodes}`)
} finally {
	reader.close()
}

console.log("----------------------------------------")
console.log("SML-IO usage")
```

## Asynchronous IO

```ts
let document = SmlDocument.parse("Root\nEnd")
await SmlFile.save(document, "Test.sml")
let loadedDocument = await SmlFile.load("Test.sml")
```