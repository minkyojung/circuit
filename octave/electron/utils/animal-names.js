/**
 * Animal Names Pool for Workspace Branch Naming
 * Provides unique, memorable names for Git worktree branches
 */

const ANIMALS = [
  'aardvark', 'albatross', 'alligator', 'alpaca', 'ant', 'anteater', 'antelope', 'armadillo',
  'baboon', 'badger', 'barracuda', 'bat', 'bear', 'beaver', 'bee', 'bison', 'boar', 'buffalo',
  'camel', 'capybara', 'caribou', 'cassowary', 'cat', 'caterpillar', 'cheetah', 'chicken', 'chimpanzee', 'chinchilla', 'chipmunk', 'cobra', 'cod', 'coyote', 'crab', 'crane', 'crocodile', 'crow',
  'deer', 'dingo', 'dog', 'dolphin', 'donkey', 'dove', 'dragonfly', 'duck', 'dugong',
  'eagle', 'echidna', 'eel', 'elephant', 'elk', 'emu', 'ermine',
  'falcon', 'ferret', 'finch', 'fish', 'flamingo', 'fox', 'frog',
  'gazelle', 'gecko', 'gerbil', 'giraffe', 'gnu', 'goat', 'goldfish', 'goose', 'gorilla', 'grasshopper', 'grizzly', 'gull',
  'hamster', 'hare', 'hawk', 'hedgehog', 'heron', 'hippo', 'hornet', 'horse', 'hummingbird', 'hyena',
  'ibex', 'ibis', 'iguana', 'impala',
  'jackal', 'jaguar', 'jay', 'jellyfish',
  'kangaroo', 'koala', 'kookaburra', 'krill',
  'ladybug', 'lemur', 'leopard', 'lion', 'lizard', 'llama', 'lobster', 'locust', 'lynx',
  'macaw', 'magpie', 'mallard', 'manatee', 'mandrill', 'mantis', 'meerkat', 'mink', 'mole', 'mongoose', 'monkey', 'moose', 'mosquito', 'moth', 'mouse', 'mule',
  'narwhal', 'newt', 'nightingale',
  'octopus', 'okapi', 'opossum', 'orangutan', 'orca', 'ostrich', 'otter', 'owl', 'ox', 'oyster',
  'panda', 'panther', 'parrot', 'peacock', 'pelican', 'penguin', 'pheasant', 'pig', 'pigeon', 'platypus', 'pony', 'porcupine', 'possum', 'prairie-dog', 'puffin', 'puma', 'python',
  'quail', 'quokka',
  'rabbit', 'raccoon', 'ram', 'rat', 'raven', 'reindeer', 'rhino', 'robin', 'rooster',
  'salamander', 'salmon', 'sandpiper', 'sardine', 'scorpion', 'seahorse', 'seal', 'shark', 'sheep', 'shrew', 'shrimp', 'skunk', 'sloth', 'snail', 'snake', 'sparrow', 'spider', 'squid', 'squirrel', 'starfish', 'stingray', 'stork', 'swallow', 'swan',
  'tapir', 'tarsier', 'tiger', 'toad', 'tortoise', 'toucan', 'trout', 'tuna', 'turkey', 'turtle',
  'viper', 'vulture',
  'wallaby', 'walrus', 'wasp', 'weasel', 'whale', 'wildcat', 'wolf', 'wolverine', 'wombat', 'woodpecker', 'worm',
  'yak',
  'zebra'
];

/**
 * Get a random unused animal name for workspace branch
 * @param {string[]} usedNames - Array of already used branch names
 * @returns {string} Available animal name
 */
function getAvailableAnimalName(usedNames = []) {
  // Filter out already used animal names
  const availableAnimals = ANIMALS.filter(animal => !usedNames.includes(animal));

  // If we have available names, return a random one
  if (availableAnimals.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableAnimals.length);
    return availableAnimals[randomIndex];
  }

  // If all animal names are used, add a numeric suffix
  let suffix = 2;
  while (true) {
    const randomAnimal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const nameWithSuffix = `${randomAnimal}-${suffix}`;

    if (!usedNames.includes(nameWithSuffix)) {
      return nameWithSuffix;
    }

    suffix++;

    // Safety check to prevent infinite loop
    if (suffix > 1000) {
      return `workspace-${Date.now()}`;
    }
  }
}

module.exports = {
  ANIMALS,
  getAvailableAnimalName
};
