# Tags

A TypeScript utility library for managing tags in JSON objects. This library
provides a simple and efficient way to add, remove, and manage tags in your
TypeScript/JavaScript applications.

## Features

- Add and remove tags from JSON objects
- Type-safe tag management with TypeScript interfaces
- Simple and intuitive API
- Built for Deno runtime

## Installation

Since this is a Deno module, you can import it directly in your Deno project:

```typescript
import { addTag, removeTag, type TagsInterface } from "@stsoftware/tags";
```

## Usage

### Basic Tag Operations

```typescript
import { addTag, removeTag, type TagsInterface } from "@stsoftware/tags";

// Create a taggable object
const taggable: TagsInterface = { tags: undefined };

// Add a tag
addTag(taggable, "hello", "world");

// Get a tag value
const value = getTag(taggable, "hello"); // Returns "world"

// Remove a tag
const removedValue = removeTag(taggable, "hello"); // Returns "world"
```

### Working with Multiple Tags

```typescript
import { addTags, type TagsInterface } from "@stsoftware/tags";

const taggable: TagsInterface = { tags: undefined };

// Add multiple tags at once
addTags(taggable, [
  { name: "category", value: "electronics" },
  { name: "price", value: "99.99" },
]);
```

## API Reference

### Interfaces

- `TagsInterface`: Defines an entity that can have tags
- `TagInterface`: Defines the structure of a tag

### Functions

- `addTag(taggable: TagsInterface, name: string, value: string): string | null`
- `addTags(taggable: TagsInterface, tags: TagInterface[]): void`
- `getTag(taggable: TagsInterface, name: string): string | null`
- `removeTag(taggable: TagsInterface, name: string): string | null`

## Application
Tag all JSON files within a directory.

```bash
deno run \
  --allow-read --allow-write \
  https://jsr.io/@stsoftware/tags/App.ts \
   --directory=.creatures \
   --tagList="TEAM_HOST=${HOST}"
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.