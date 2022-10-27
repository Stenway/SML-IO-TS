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