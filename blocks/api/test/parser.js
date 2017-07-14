/**
 * External dependencies
 */
import { noop } from 'lodash';

/**
 * Internal dependencies
 */
import { text, attr, html } from '../query';
import {
	isValidMatcher,
	getBlockAttributes,
	getMatcherAttributes,
	createBlockWithFallback,
	default as parse,
} from '../parser';
import {
	registerBlockType,
	unregisterBlockType,
	getBlockTypes,
	setUnknownTypeHandler,
} from '../registration';

describe( 'block parser', () => {
	const defaultBlockSettings = {
		attributes: {
			fruit: String,
		},
		save: ( { attributes } ) => attributes.fruit,
	};

	afterEach( () => {
		setUnknownTypeHandler( undefined );
		getBlockTypes().forEach( ( block ) => {
			unregisterBlockType( block.name );
		} );
	} );

	describe( 'isValidMatcher()', () => {
		it( 'returns false if falsey argument', () => {
			expect( isValidMatcher() ).toBe( false );
		} );

		it( 'returns true if valid matcher argument', () => {
			expect( isValidMatcher( text() ) ).toBe( true );
		} );

		it( 'returns false if invalid matcher argument', () => {
			expect( isValidMatcher( () => {} ) ).toBe( false );
		} );
	} );

	describe( 'getMatcherAttributes()', () => {
		it( 'should return matched attributes from valid matchers', () => {
			const sources = {
				number: Number,
				emphasis: {
					matcher: text( 'strong' ),
				},
			};

			const rawContent = '<span>Ribs <strong>& Chicken</strong></span>';

			expect( getMatcherAttributes( rawContent, sources ) ).toEqual( {
				emphasis: '& Chicken',
			} );
		} );

		it( 'should return an empty object if no sources defined', () => {
			const sources = {};
			const rawContent = '<span>Ribs <strong>& Chicken</strong></span>';

			expect( getMatcherAttributes( rawContent, sources ) ).toEqual( {} );
		} );
	} );

	describe( 'getBlockAttributes()', () => {
		it( 'should merge attributes with the parsed and default attributes', () => {
			const blockType = {
				attributes: {
					content: text( 'div' ),
					number: {
						type: Number,
						matcher: attr( 'div', 'data-number' ),
					},
					align: String,
					topic: {
						type: String,
						defaultValue: 'none',
					},
					ignoredDomMatcher: {
						matcher: ( node ) => node.innerHTML,
					},
				},
			};

			const rawContent = '<div data-number="10">Ribs</div>';
			const attrs = { align: 'left', invalid: true };

			expect( getBlockAttributes( blockType, rawContent, attrs ) ).toEqual( {
				content: 'Ribs',
				number: 10,
				align: 'left',
				topic: 'none',
			} );
		} );
	} );

	describe( 'createBlockWithFallback', () => {
		it( 'should create the requested block if it exists', () => {
			registerBlockType( 'core/test-block', defaultBlockSettings );

			const block = createBlockWithFallback(
				'core/test-block',
				'content',
				{ fruit: 'Bananas' }
			);
			expect( block.name ).toEqual( 'core/test-block' );
			expect( block.attributes ).toEqual( { fruit: 'Bananas' } );
		} );

		it( 'should create the requested block with no attributes if it exists', () => {
			registerBlockType( 'core/test-block', defaultBlockSettings );

			const block = createBlockWithFallback( 'core/test-block', 'content' );
			expect( block.name ).toEqual( 'core/test-block' );
			expect( block.attributes ).toEqual( {} );
		} );

		it( 'should fall back to the unknown type handler for unknown blocks if present', () => {
			registerBlockType( 'core/unknown-block', defaultBlockSettings );
			setUnknownTypeHandler( 'core/unknown-block' );

			const block = createBlockWithFallback(
				'core/test-block',
				'content',
				{ fruit: 'Bananas' }
			);
			expect( block.name ).toEqual( 'core/unknown-block' );
			expect( block.attributes ).toEqual( { fruit: 'Bananas' } );
		} );

		it( 'should fall back to the unknown type handler if block type not specified', () => {
			registerBlockType( 'core/unknown-block', defaultBlockSettings );
			setUnknownTypeHandler( 'core/unknown-block' );

			const block = createBlockWithFallback( null, 'content' );
			expect( block.name ).toEqual( 'core/unknown-block' );
			expect( block.attributes ).toEqual( {} );
		} );

		it( 'should not create a block if no unknown type handler', () => {
			const block = createBlockWithFallback( 'core/test-block', 'content' );
			expect( block ).toBeUndefined();
		} );
	} );

	describe( 'parse()', () => {
		it( 'should parse the post content, including block attributes', () => {
			registerBlockType( 'core/test-block', {
				attributes: {
					content: text(),
					smoked: String,
					url: String,
					chicken: String,
				},
				save: noop,
			} );

			const parsed = parse(
				'<!-- wp:core/test-block {"smoked":"yes","url":"http://google.com","chicken":"ribs & \'wings\'"} -->' +
				'Brisket' +
				'<!-- /wp:core/test-block -->'
			);

			expect( parsed ).toHaveLength( 1 );
			expect( parsed[ 0 ].name ).toBe( 'core/test-block' );
			expect( parsed[ 0 ].attributes ).toEqual( {
				content: 'Brisket',
				smoked: 'yes',
				url: 'http://google.com',
				chicken: 'ribs & \'wings\'',
			} );
			expect( typeof parsed[ 0 ].uid ).toBe( 'string' );
		} );

		it( 'should parse empty post content', () => {
			const parsed = parse( '' );

			expect( parsed ).toEqual( [] );
		} );

		it( 'should parse the post content, ignoring unknown blocks', () => {
			registerBlockType( 'core/test-block', {
				attributes: {
					content: text(),
				},
				save: noop,
			} );

			const parsed = parse(
				'<!-- wp:core/test-block -->\nRibs\n<!-- /wp:core/test-block -->' +
				'<p>Broccoli</p>' +
				'<!-- wp:core/unknown-block -->Ribs<!-- /wp:core/unknown-block -->'
			);

			expect( parsed ).toHaveLength( 1 );
			expect( parsed[ 0 ].name ).toBe( 'core/test-block' );
			expect( parsed[ 0 ].attributes ).toEqual( {
				content: 'Ribs',
			} );
			expect( typeof parsed[ 0 ].uid ).toBe( 'string' );
		} );

		it( 'should parse the post content, using unknown block handler', () => {
			registerBlockType( 'core/test-block', defaultBlockSettings );
			registerBlockType( 'core/unknown-block', defaultBlockSettings );

			setUnknownTypeHandler( 'core/unknown-block' );

			const parsed = parse(
				'<!-- wp:core/test-block -->Ribs<!-- /wp:core/test-block -->' +
				'<p>Broccoli</p>' +
				'<!-- wp:core/unknown-block -->Ribs<!-- /wp:core/unknown-block -->'
			);

			expect( parsed ).toHaveLength( 3 );
			expect( parsed.map( ( { name } ) => name ) ).toEqual( [
				'core/test-block',
				'core/unknown-block',
				'core/unknown-block',
			] );
		} );

		it( 'should parse the post content, including raw HTML at each end', () => {
			registerBlockType( 'core/test-block', defaultBlockSettings );
			registerBlockType( 'core/unknown-block', {
				attributes: {
					content: html(),
				},
				save: noop,
			} );

			setUnknownTypeHandler( 'core/unknown-block' );

			const parsed = parse(
				'<p>Cauliflower</p>' +
				'<!-- wp:core/test-block -->Ribs<!-- /wp:core/test-block -->' +
				'\n<p>Broccoli</p>\n' +
				'<!-- wp:core/test-block -->Ribs<!-- /wp:core/test-block -->' +
				'<p>Romanesco</p>'
			);

			expect( parsed ).toHaveLength( 5 );
			expect( parsed.map( ( { name } ) => name ) ).toEqual( [
				'core/unknown-block',
				'core/test-block',
				'core/unknown-block',
				'core/test-block',
				'core/unknown-block',
			] );
			expect( parsed[ 0 ].attributes.content ).toEqual( '<p>Cauliflower</p>' );
			expect( parsed[ 2 ].attributes.content ).toEqual( '<p>Broccoli</p>' );
			expect( parsed[ 4 ].attributes.content ).toEqual( '<p>Romanesco</p>' );
		} );

		it( 'should parse blocks with empty content', () => {
			registerBlockType( 'core/test-block', defaultBlockSettings );
			const parsed = parse(
				'<!-- wp:core/test-block --><!-- /wp:core/test-block -->'
			);

			expect( parsed ).toHaveLength( 1 );
			expect( parsed.map( ( { name } ) => name ) ).toEqual( [
				'core/test-block',
			] );
		} );

		it( 'should parse void blocks', () => {
			registerBlockType( 'core/test-block', defaultBlockSettings );
			registerBlockType( 'core/void-block', defaultBlockSettings );
			const parsed = parse(
				'<!-- wp:core/test-block --><!-- /wp:core/test-block -->' +
				'<!-- wp:core/void-block /-->'
			);

			expect( parsed ).toHaveLength( 2 );
			expect( parsed.map( ( { name } ) => name ) ).toEqual( [
				'core/test-block', 'core/void-block',
			] );
		} );
	} );
} );
