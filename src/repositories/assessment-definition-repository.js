import { createAssessmentDefinition } from "../data/models.js";
import { COLLECTIONS } from "../data/schema.js";
import { BaseRepository } from "./base-repository.js";

export class AssessmentDefinitionRepository extends BaseRepository {
  constructor(storage) {
    super({
      collectionName: COLLECTIONS.assessmentDefinitions,
      createEntity: createAssessmentDefinition,
      ...storage
    });
  }

  findByCategory(category) {
    return this.list().filter((def) => def.category === category);
  }
}
