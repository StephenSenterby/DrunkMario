/* global Phaser */
(() => {
  'use strict';

  const WORLD = { width: 960, height: 540, floor: 470 };
  const PHYSICS = {
    acceleration: 660, maxSpeed: 240, drag: 165, gravity: 1100,
    jumpSpeed: 455, jumpDelay: [90, 260], stumbleInterval: [650, 1400],
  };
  const status = document.querySelector('#game-status');
  const host = document.querySelector('#game');
  const random = (min, max) => Phaser.Math.Between(min, max);
  const controls = { left: false, right: false, jump: false };

  if (!window.Phaser) {
    status.textContent = 'The game engine could not load. Check your connection and reload.';
    return;
  }

  class Neighborhood extends Phaser.Scene {
    constructor() { super('Neighborhood'); }

    create() {
      this.finished = false;
      this.pendingJump = null;
      this.nextStumble = this.time.now + random(...PHYSICS.stumbleInterval);
      this.jumpWasHeld = false;
      Object.keys(controls).forEach(key => { controls[key] = false; });
      this.drawNeighborhood();
      this.makeTextures();
      this.platforms = this.physics.add.staticGroup();
      // A visible gap makes falling a real gameplay hazard.
      [[215, 430], [735, 450]].forEach(([x, width]) => {
        this.platforms.create(x, WORLD.floor + 35, 'ground')
          .setDisplaySize(width, 70).refreshBody();
      });
      this.physics.world.setBoundsCollision(true, true, true, false);
      [[330, 400, 130], [535, 340, 130], [760, 290, 180]].forEach(([x, y, width]) => {
        const platform = this.platforms.create(x, y, 'ledge');
        platform.setDisplaySize(width, 22).refreshBody();
      });
      this.player = this.physics.add.sprite(100, 430, 'player');
      this.player.body.setSize(24, 43).setOffset(10, 7);
      this.player.setCollideWorldBounds(true).setMaxVelocity(PHYSICS.maxSpeed, 700);
      this.player.setDragX(PHYSICS.drag);
      this.physics.add.collider(this.player, this.platforms);
      this.goal = this.add.zone(810, 246, 58, 66);
      this.physics.add.existing(this.goal, true);
      this.physics.add.overlap(this.player, this.goal, () => this.win());
      this.keys = this.input.keyboard.addKeys({
        left: 'LEFT', right: 'RIGHT', a: 'A', d: 'D', up: 'UP', w: 'W', space: 'SPACE',
      }, false);
      // Capture gameplay keys only while the canvas region has keyboard focus.
      this.captureKeys = event => {
        if (host.contains(document.activeElement) &&
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(event.code)) event.preventDefault();
      };
      window.addEventListener('keydown', this.captureKeys);
      this.events.once('shutdown', () => window.removeEventListener('keydown', this.captureKeys));
      status.textContent = 'Reach the yellow flag. Jump early — your feet need a moment to catch up.';
    }

    makeTextures() {
      if (this.textures.exists('player')) return;
      const art = this.make.graphics({ x: 0, y: 0, add: false });
      art.fillStyle(0x735c45).fillRect(0, 0, 960, 70);
      art.fillStyle(0x526b4d).fillRect(0, 0, 960, 12);
      art.generateTexture('ground', 960, 70).clear();
      art.fillStyle(0x735c45).fillRoundedRect(0, 0, 180, 22, 4);
      art.fillStyle(0x66815a).fillRect(0, 0, 180, 7);
      art.generateTexture('ledge', 180, 22).clear();
      // An original blocky traveler, intentionally independent of Nintendo artwork.
      art.fillStyle(0x293a4c).fillRect(8, 44, 12, 8).fillRect(26, 44, 12, 8);
      art.fillStyle(0x476b83).fillRect(12, 29, 24, 18);
      art.fillStyle(0xc77b51).fillRect(7, 23, 32, 13);
      art.fillStyle(0xf1c89d).fillRect(12, 8, 24, 17);
      art.fillStyle(0x403c34).fillRect(11, 4, 26, 8).fillRect(6, 10, 35, 5);
      art.fillStyle(0x273644).fillRect(28, 16, 3, 4);
      art.generateTexture('player', 46, 54);
      art.destroy();
    }

    drawNeighborhood() {
      const art = this.add.graphics();
      art.fillStyle(0xb5cdc1).fillRect(0, 0, 960, 540);
      art.fillStyle(0xf2deb2).fillCircle(780, 95, 39);
      art.fillStyle(0x9db7ab).fillTriangle(0, 350, 220, 170, 470, 350)
        .fillTriangle(380, 350, 670, 140, 960, 350);
      art.fillStyle(0x8aa394).fillTriangle(0, 430, 130, 260, 380, 430)
        .fillTriangle(500, 430, 820, 230, 1100, 430);
      art.fillStyle(0xdce4d3, .8).fillRoundedRect(145, 90, 120, 20, 10)
        .fillRoundedRect(430, 65, 95, 16, 8);
      art.lineStyle(4, 0x354e48).lineBetween(810, 286, 810, 203);
      art.fillStyle(0xf3c65e).fillTriangle(812, 204, 853, 216, 812, 231);
      this.add.text(40, 36, 'TAKE IT ONE WOBBLE AT A TIME', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#344e47', letterSpacing: 2,
      });
      this.add.text(55, 482, 'HOME IS THAT WAY →', { fontFamily: 'sans-serif', fontSize: '12px', color: '#ece2c7' });
    }

    queueJump() {
      if (!this.player.body.blocked.down || this.pendingJump || this.finished) return;
      status.textContent = 'Jump requested… waiting for your feet.';
      this.pendingJump = this.time.delayedCall(random(...PHYSICS.jumpDelay), () => {
        this.pendingJump = null;
        if (this.player.body.blocked.down && !this.finished) {
          this.player.setVelocityY(-PHYSICS.jumpSpeed + random(-35, 35));
          this.player.setVelocityX(this.player.body.velocity.x + random(-35, 35));
        }
        if (!this.finished) status.textContent = 'Keep your balance. The flag is waiting.';
      });
    }

    update(time) {
      if (!this.player || this.finished) return;
      if (this.player.y > WORLD.height + this.player.height) {
        this.restartAfterFall();
        return;
      }
      const focused = host.contains(document.activeElement);
      const held = key => focused && this.keys[key].isDown;
      const direction = Number(controls.right || held('right') || held('d')) -
        Number(controls.left || held('left') || held('a'));
      this.player.setAccelerationX(direction * PHYSICS.acceleration);
      if (direction) this.player.setFlipX(direction < 0);
      const jumpHeld = controls.jump || held('space') || held('up') || held('w');
      if (jumpHeld && !this.jumpWasHeld) this.queueJump();
      this.jumpWasHeld = jumpHeld;
      // Time-based impulses avoid frame-rate-dependent randomness.
      if (time >= this.nextStumble) {
        this.nextStumble = time + random(...PHYSICS.stumbleInterval);
        if (this.player.body.blocked.down && Math.abs(this.player.body.velocity.x) > 20) {
          this.player.setVelocityX(this.player.body.velocity.x + random(-95, 95));
        }
      }
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.player.setAngle(reducedMotion ? 0 : Math.sin(time / 140) *
        Math.min(Math.abs(this.player.body.velocity.x) / 22, 10));
    }

    restartAfterFall() {
      this.finished = true;
      if (this.pendingJump) this.pendingJump.remove();
      this.player.setAccelerationX(0).setVelocity(0);
      status.textContent = 'Whoops! Lost your footing. Trying again…';
      this.time.delayedCall(650, () => this.scene.restart());
    }

    win() {
      if (this.finished) return;
      this.finished = true;
      if (this.pendingJump) this.pendingJump.remove();
      this.player.setAccelerationX(0).setVelocity(0).setAngle(0);
      status.textContent = 'You made it! A small step for you. A miracle for your balance. Start over to play again.';
      this.add.text(480, 170, 'HOME. EVENTUALLY.', {
        fontFamily: 'sans-serif', fontSize: '30px', fontStyle: 'bold', color: '#263c36',
        backgroundColor: '#f2deb2', padding: { x: 24, y: 16 },
      }).setOrigin(.5);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: WORLD.width, height: WORLD.height,
    backgroundColor: '#b5cdc1',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: PHYSICS.gravity }, debug: false } },
    scene: Neighborhood,
  });

  host.addEventListener('pointerdown', () => host.focus({ preventScroll: true }));

  document.querySelector('#restart').addEventListener('click', () => {
    if (game.scene.isActive('Neighborhood')) game.scene.getScene('Neighborhood').scene.restart();
    host.focus({ preventScroll: true });
  });
  document.querySelectorAll('[data-control]').forEach(button => {
    const name = button.dataset.control;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      controls[name] = true;
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
      button.addEventListener(type, () => { controls[name] = false; });
    });
  });
  window.addEventListener('blur', () => {
    Object.keys(controls).forEach(key => { controls[key] = false; });
    game.input.keyboard.resetKeys();
  });
})();
