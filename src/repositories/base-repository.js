export class BaseRepository {
  constructor({ collectionName, createEntity, loadState, saveState }) {
    this.collectionName = collectionName;
    this.createEntity = createEntity;
    this.loadState = loadState;
    this.saveState = saveState;
  }

  list() {
    return [...this.loadState()[this.collectionName]];
  }

  findById(id) {
    return this.list().find((item) => item.id === id) || null;
  }

  create(input) {
    const state = this.loadState();
    const entity = this.createEntity(input);
    return this.persistCollection(state, [...state[this.collectionName], entity]);
  }

  update(id, input) {
    const state = this.loadState();
    const collection = state[this.collectionName].map((item) => {
      if (item.id !== id) {
        return item;
      }

      return this.createEntity({
        ...item,
        ...input,
        id: item.id,
        createdAt: item.createdAt
      });
    });

    return this.persistCollection(state, collection);
  }

  delete(id) {
    const state = this.loadState();
    const collection = state[this.collectionName].filter((item) => item.id !== id);
    return this.persistCollection(state, collection);
  }

  persistCollection(state, collection) {
    this.saveState({
      ...state,
      [this.collectionName]: collection
    });
    return collection;
  }
}
