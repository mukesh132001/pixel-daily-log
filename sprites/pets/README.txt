Pixmod Pet Pack - 22 original pixel pets (11 dogs, 11 cats)

DOGS  common: Shiba, Corgi, Golden Retriever, Black Lab
      rare: Beagle, Dalmatian, Pug   epic: Husky, Poodle, Samoyed
      legendary: Pixel Pup
CATS  common: Orange Tabby, Black Cat, Snow, Russian Blue
      rare: Brown Tabby, Tuxedo, Calico   epic: Siamese, Maine Coon, Ragdoll
      legendary: Cosmic Cat

Each frame is 21x21 px, drawn natively (feet on row 19). Every sheet has 8 frames, left to right:
  sitA, sitB (idle tail wag), blink, happy (heart), eatA, eatB (with bowl), sleepA, sleepB

sheets_1x/<id>.png   native size (scale in CSS with image-rendering: pixelated)
pets.json            names, kind, rarity, unlock cost, atlas row, frame list
gifs/<id>.gif        animated preview of each pet
pet_shelter.html     playable prototype: earn points, adopt, feed, pet, nap
source/              Python generator - add a breed in breeds.py, run export.py

Suggested costs: common 50, rare 150, epic 300, legendary 600 points.
