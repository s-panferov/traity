import { Trait, implement, instantiate } from "..";
import { Dog } from "./dog";

export abstract class SpeakTrait extends Trait {
  abstract echo<A>(value: A): A;
}

export const Speak = instantiate(SpeakTrait);

class DogSpeak extends Speak.Trait {
  echo<A>(this: Dog, value: A) {
    return value;
  }
}

declare module "./dog" {
  export interface Dog extends Speak.Trait {}
}

implement(Speak.Trait)
  .for(Dog)
  .where(d => d.name == "Barkey")
  .with(DogSpeak);

let dog = new Dog("Barkey");
Speak.echo(dog, "test");

console.log(dog.echo("test"));
console.log(SpeakCall.echo(dog, "test"));
