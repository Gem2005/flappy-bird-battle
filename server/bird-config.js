const BIRD_CONFIGS = {
  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    stats: {
      hp: 80,
      speed: 90,
      attack: 100
    },
    abilities: {
      normal: {
        name: "Ember Shot",
        key: "Q",
        damage: 10,
        cooldown: 6000, // 6 seconds
        type: "projectile",
        description: "10 damage projectile"
      },
      signature: {
        name: "Flame Wave",
        key: "E",
        damage: 20,
        cooldown: 10000, // 10 seconds
        type: "aoe",
        description: "20 AoE damage wave"
      },
      ultimate: {
        name: "Rebirth",
        key: "X",
        heal: 50,
        cooldown: 15000, // 15 seconds
        type: "heal",
        usesPerMatch: 1,
        description: "Heal 50 HP (once per match)"
      }
    }
  },
  frostbeak: {
    id: "frostbeak",
    name: "Frostbeak",
    stats: {
      hp: 90,
      speed: 70,
      attack: 75
    },
    abilities: {
      normal: {
        name: "Ice Shard",
        key: "Q",
        damage: 8,
        cooldown: 6000,
        type: "projectile",
        statusEffect: "slow",
        statusDuration: 3000, // 3 seconds
        description: "8 damage + slow effect"
      },
      signature: {
        name: "Blizzard",
        key: "E",
        damage: 0,
        cooldown: 10000,
        type: "obstacle",
        duration: 5000, // 5 seconds
        description: "Creates obstacle for opponent"
      },
      ultimate: {
        name: "Freeze Time",
        key: "X",
        damage: 0,
        cooldown: 15000,
        type: "disable",
        statusEffect: "freeze",
        statusDuration: 3000, // 3 seconds
        description: "Freezes opponent for 3 seconds"
      }
    }
  },
  thunderwing: {
    id: "thunderwing",
    name: "Thunderwing",
    stats: {
      hp: 70,
      speed: 100,
      attack: 80
    },
    abilities: {
      normal: {
        name: "Shock Bolt",
        key: "Q",
        damage: 12,
        cooldown: 6000,
        type: "lightning",
        description: "12 damage lightning"
      },
      signature: {
        name: "Wind Gust",
        key: "E",
        damage: 0,
        cooldown: 10000,
        type: "push",
        pushForce: 200,
        description: "Pushes opponent toward obstacles"
      },
      ultimate: {
        name: "Lightning Strike",
        key: "X",
        damage: 30,
        cooldown: 15000,
        type: "chain",
        chainRange: 150,
        description: "30 damage, chains to obstacles"
      }
    }
  },
  shadowfeather: {
    id: "shadowfeather",
    name: "Shadowfeather",
    stats: {
      hp: 60,
      speed: 85,
      attack: 90
    },
    abilities: {
      normal: {
        name: "Shadow Strike",
        key: "Q",
        damage: 15,
        cooldown: 6000,
        type: "stealth",
        description: "15 damage stealth attack"
      },
      signature: {
        name: "Vanish",
        key: "E",
        damage: 0,
        cooldown: 10000,
        type: "invulnerability",
        statusEffect: "invulnerable",
        statusDuration: 2000, // 2 seconds
        description: "2 seconds invulnerability"
      },
      ultimate: {
        name: "Nightmare",
        key: "X",
        damage: 0,
        cooldown: 15000,
        type: "control",
        statusEffect: "nightmare",
        statusDuration: 5000, // 5 seconds
        description: "Reverses controls + disables abilities"
      }
    }
  }
};

// Universal ability available to all birds
const UNIVERSAL_ABILITY = {
  heal: {
    name: "Heal",
    key: "C",
    heal: 15,
    cooldown: 10000, // 10 seconds
    type: "heal",
    description: "Heal 15 HP"
  }
};

module.exports = { BIRD_CONFIGS, UNIVERSAL_ABILITY };
