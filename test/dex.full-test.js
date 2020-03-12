const assert = require('assert').strict;

window = global;

// For testing @pokemon-showdown/client
// const client = require('../package/build');
// const Dex = client.Dex;

window.BattleTeambuilderTable = require('../data/teambuilder-tables.js').BattleTeambuilderTable;
window.BattleAbilities = require('../data/abilities.js').BattleAbilities;
window.BattleItems = require('../data/items.js').BattleItems;
window.BattleMovedex = require('../data/moves.js').BattleMovedex;
window.BattlePokdex = require('../data/pokedex.js').BattlePokdex;
window.BattleTypeChart = require('../data/typechart.js').BattleTypeChart;

require('../js/battle-dex-data.js');
require('../js/battle-dex.js');

const withPrefs = (prefs, fn) => {
	const saved = Dex.prefs;
	Dex.prefs = s => prefs[s];
	fn();
	Dex.prefs = saved;
};

const spriteData = override => {
	const url = Dex.resourcePrefix + 'sprites/' + (override.url || '');
	delete override.url;
	return Object.assign({
		gen: 6,
		w: 96,
		h: 96,
		y: 0,
		url,
		cryurl: '',
		shiny: undefined,
	}, override);
};

describe('Dex', () => {
	it('getSpriteData', () => {
		// TODO Transform
		// TODO Dynamax
		it('default prefs', () => {
			// withPrefs({}) or no withPrefs accomplishes the same, but this is explict
			withPrefs({nopastgens: false, bwgfx: false, noanim: false, nogif: false}, () => {
				assert.deepEqual(Dex.getSpriteData('pikachu', 0), spriteData({url: 'gen5-back/pikachu.png', pixelated: false, isBackSprite: true}));
				assert.deepEqual(Dex.getSpriteData('pikachu', 1, {gen: 4, shiny: true}), spriteData({url: 'gen4/pikachu-shiny.png', pixelated: true, isBackSprite: false}));
			});
		})
		// TODO oodles more
	});
	it('getTeambuilderSprite', () => {
		assert.equal(Dex.getTeambuilderSprite({species: 'foobar'}), 'background-image:url(https://play.pokemonshowdown.com/sprites/gen5/0.png);background-position:10px 5px;background-repeat:no-repeat');
		assert.equal(Dex.getTeambuilderSprite({species: 'pikachu'}), 'background-image:url(https://play.pokemonshowdown.com/sprites/dex/pikachu.png);background-position:-2px -3px;background-repeat:no-repeat');
		assert.equal(Dex.getTeambuilderSprite({species: 'pikachu'}, 1), 'background-image:url(https://play.pokemonshowdown.com/sprites/gen1/pikachu.png);background-position:10px 5px;background-repeat:no-repeat');
		assert.equal(Dex.getTeambuilderSprite({species: 'gyarados', shiny: true}, 3), 'background-image:url(https://play.pokemonshowdown.com/sprites/gen3-shiny/gyarados.png);background-position:10px 5px;background-repeat:no-repeat');
	});

	it('getTeambuilderSpriteData', () => {
		// Basic
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'foobar'}), {spriteDir: 'sprites/gen5', spriteid: '0', x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'pikachu'}), {spriteDir: 'sprites/dex', spriteid: 'pikachu', x: -2, y: -3});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'pikachu'}, 1), { spriteDir: 'sprites/gen1', spriteid: 'pikachu', x: 10, y: 5 });
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'gyarados', shiny: true}, 3), {spriteDir: 'sprites/gen3', spriteid: 'gyarados', shiny: true, x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'eiscue', spriteid: 'pikachu'}), {spriteDir: 'sprites/gen5', spriteid: 'pikachu', x: 10, y: 5});

		// XY Dex
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'eiscue'}), {spriteDir: 'sprites/gen5', spriteid: 'eiscue', x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'melmetal'}, 7), {spriteDir: 'sprites/dex', spriteid: 'melmetal', x: -6, y: -7});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Araquanid-Totem'}), {spriteDir: 'sprites/dex', spriteid: 'araquanid', x: -6, y: -7});

		// Special XY Offsets
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Arceus-Grass'}, 7), {spriteDir: 'sprites/dex', spriteid: 'arceus-grass', x: -2, y: 7});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Arceus-Electric'}, 4), {spriteDir: 'sprites/gen4', spriteid: 'arceus-electric', x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Garchomp'}), {spriteDir: 'sprites/dex', spriteid: 'garchomp', x: -2, y: 2});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Garchomp'}, 5), {spriteDir: 'sprites/gen5', spriteid: 'garchomp', x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Garchomp-Mega'}), {spriteDir: 'sprites/dex', spriteid: 'garchomp-mega', x: -2, y: 0});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Garchomp-Mega'}, 5), {spriteDir: 'sprites/gen5', spriteid: 'garchomp-mega', x: 10, y: 5});

		// Rollup
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Garchomp'}, 1), {spriteDir: 'sprites/gen4', spriteid: 'garchomp', x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Froakie'}, 2), {spriteDir: 'sprites/gen5', spriteid: 'froakie', x: 10, y: 5});
		assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'Tyranitar'}, 1), {spriteDir: 'sprites/gen2', spriteid: 'tyranitar', x: 10, y: 5});

		// No Past Gens
		withPrefs({nopastgens: true}, () => {
			assert.deepEqual(Dex.getTeambuilderSpriteData({species: 'pikachu'}, 1), {spriteDir: 'sprites/dex', spriteid: 'pikachu', x: -2, y: -3});
		});
	});
});

