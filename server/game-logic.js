const { BIRD_CONFIGS, UNIVERSAL_ABILITY } = require('./bird-config');

class GameLogic {
  constructor() {
    this.gameRooms = new Map();
  }

  // Initialize player with selected bird
  initializePlayer(playerId, birdType) {
    const birdConfig = BIRD_CONFIGS[birdType];
    if (!birdConfig) {
      throw new Error(`Invalid bird type: ${birdType}`);
    }

    return {
      id: playerId,
      bird: birdType,
      hp: birdConfig.stats.hp,
      maxHp: birdConfig.stats.hp,
      speed: birdConfig.stats.speed,
      attack: birdConfig.stats.attack,
      position: { x: 100, y: 300 },
      score: 0,
      isAlive: true,
      statusEffects: new Map(),
      abilityCooldowns: new Map(),
      ultimateUsesLeft: birdConfig.abilities.ultimate.usesPerMatch || Infinity
    };
  }

  // Handle ability usage
  useAbility(roomId, playerId, abilityType) {
    const room = this.gameRooms.get(roomId);
    if (!room) return { success: false, error: "Room not found" };

    const player = room.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: "Player not found" };

    const birdConfig = BIRD_CONFIGS[player.bird];
    let ability;

    // Handle universal heal ability
    if (abilityType === 'universal') {
      ability = UNIVERSAL_ABILITY.heal;
    } else {
      ability = birdConfig.abilities[abilityType];
    }

    if (!ability) return { success: false, error: "Invalid ability" };

    // Check cooldown
    const cooldownKey = `${abilityType}`;
    const lastUsed = player.abilityCooldowns.get(cooldownKey) || 0;
    const now = Date.now();
    
    if (now - lastUsed < ability.cooldown) {
      return { 
        success: false, 
        error: "Ability on cooldown",
        remainingCooldown: ability.cooldown - (now - lastUsed)
      };
    }

    // Check ultimate uses
    if (abilityType === 'ultimate' && player.ultimateUsesLeft <= 0) {
      return { success: false, error: "Ultimate already used" };
    }

    // Execute ability effect
    const result = this.executeAbility(room, player, ability, abilityType);
    
    if (result.success) {
      // Set cooldown
      player.abilityCooldowns.set(cooldownKey, now);
      
      // Decrease ultimate uses
      if (abilityType === 'ultimate') {
        player.ultimateUsesLeft--;
      }
    }

    return result;
  }

  // Execute specific ability effects
  executeAbility(room, caster, ability, abilityType) {
    const opponent = room.players.find(p => p.id !== caster.id);
    if (!opponent) return { success: false, error: "Opponent not found" };

    const result = {
      success: true,
      effects: [],
      damage: 0,
      healing: 0
    };

    switch (ability.type) {
      case 'projectile':
      case 'lightning':
      case 'stealth':
        // Direct damage abilities
        const damage = this.calculateDamage(caster, ability.damage);
        this.dealDamage(opponent, damage);
        result.damage = damage;
        result.effects.push({
          type: 'damage',
          target: opponent.id,
          amount: damage
        });
        break;

      case 'aoe':
        // Area of effect damage
        const aoeDamage = this.calculateDamage(caster, ability.damage);
        this.dealDamage(opponent, aoeDamage);
        result.damage = aoeDamage;
        result.effects.push({
          type: 'aoe_damage',
          target: opponent.id,
          amount: aoeDamage
        });
        break;

      case 'heal':
        // Healing abilities
        const healAmount = ability.heal;
        this.healPlayer(caster, healAmount);
        result.healing = healAmount;
        result.effects.push({
          type: 'heal',
          target: caster.id,
          amount: healAmount
        });
        break;

      case 'disable':
      case 'invulnerability':
      case 'control':
        // Status effect abilities
        this.applyStatusEffect(
          ability.statusEffect === 'invulnerable' ? caster : opponent,
          ability.statusEffect,
          ability.statusDuration
        );
        result.effects.push({
          type: 'status_effect',
          target: ability.statusEffect === 'invulnerable' ? caster.id : opponent.id,
          effect: ability.statusEffect,
          duration: ability.statusDuration
        });
        break;

      case 'push':
        // Environmental manipulation
        result.effects.push({
          type: 'push',
          target: opponent.id,
          force: ability.pushForce
        });
        break;

      case 'obstacle':
        // Create obstacles
        result.effects.push({
          type: 'create_obstacle',
          target: opponent.id,
          duration: ability.duration
        });
        break;

      case 'chain':
        // Chain lightning damage
        const chainDamage = this.calculateDamage(caster, ability.damage);
        this.dealDamage(opponent, chainDamage);
        result.damage = chainDamage;
        result.effects.push({
          type: 'chain_damage',
          target: opponent.id,
          amount: chainDamage,
          chainRange: ability.chainRange
        });
        break;
    }

    // Apply status effects from normal abilities
    if (ability.statusEffect && ability.statusDuration) {
      this.applyStatusEffect(opponent, ability.statusEffect, ability.statusDuration);
      result.effects.push({
        type: 'status_effect',
        target: opponent.id,
        effect: ability.statusEffect,
        duration: ability.statusDuration
      });
    }

    return result;
  }

  // Calculate damage based on attacker's stats
  calculateDamage(attacker, baseDamage) {
    // Apply attack stat modifier
    const attackModifier = attacker.attack / 100;
    return Math.floor(baseDamage * attackModifier);
  }

  // Deal damage to a player
  dealDamage(player, damage) {
    // Check for invulnerability
    if (player.statusEffects.has('invulnerable')) {
      return 0;
    }

    player.hp = Math.max(0, player.hp - damage);
    
    if (player.hp <= 0) {
      player.isAlive = false;
    }

    return damage;
  }

  // Heal a player
  healPlayer(player, healAmount) {
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
    player.hp += actualHeal;
    return actualHeal;
  }

  // Apply status effects
  applyStatusEffect(player, effect, duration) {
    const endTime = Date.now() + duration;
    player.statusEffects.set(effect, endTime);

    // Auto-remove after duration
    setTimeout(() => {
      player.statusEffects.delete(effect);
    }, duration);
  }

  // Check if player has active status effect
  hasStatusEffect(player, effect) {
    const endTime = player.statusEffects.get(effect);
    if (!endTime) return false;
    
    if (Date.now() > endTime) {
      player.statusEffects.delete(effect);
      return false;
    }
    
    return true;
  }

  // Get bird configuration
  getBirdConfig(birdType) {
    return BIRD_CONFIGS[birdType];
  }

  // Validate bird selection
  isValidBird(birdType) {
    return BIRD_CONFIGS.hasOwnProperty(birdType);
  }

  // Set game rooms reference
  setGameRooms(gameRooms) {
    this.gameRooms = gameRooms;
  }
}

module.exports = GameLogic;
