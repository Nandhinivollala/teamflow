export type DomainEvent<TName extends string, TPayload> = {
  id: string;
  name: TName;
  occurredAt: Date;
  aggregateId: string;
  payload: TPayload;
};

export interface DomainEventPublisher {
  publish(events: ReadonlyArray<DomainEvent<string, unknown>>): Promise<void>;
}
