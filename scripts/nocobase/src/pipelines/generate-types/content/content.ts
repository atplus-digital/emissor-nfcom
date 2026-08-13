// Barrel re-export file for content generation modules
// @see sorting.ts - field sorting/categorization
// @see enums.ts - enum generation (labels, schemas, types)
// @see interfaces.ts - interface/relation/schema generation
// @see assembly.ts - collection assembly + file content generation

// Assembly functions (only the ones consumed externally)
export {
	generateContent,
	generateFileHeader,
	generateIndexContent,
	generateLabelsContent,
	generateSchemasContent,
} from "./assembly";
