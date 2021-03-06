const chai = require( "chai" );
const chaiAsPromised = require( "chai-as-promised" );
chai.use( chaiAsPromised );
const expect = chai.expect;
const isFunction = require( "lodash.isfunction" );

const sinon = require( "sinon" );
const xbarFacade = require( "../src/crossbar.js" );

describe( "crossbarServer", () => {

    const DEFAULT_OPTS = {
        connect: {
            "url": "ws://localhost:8080/ws",
            "realm": "realm1"
        },
        publish: {},
        subscribe: {},
        call: {},
        register: {}
    };

    const server = Object.assign( {}, xbarFacade() );

    const rpcList = [ {
        name: "hello",
        func: () => "Hello World"
    }, {
        name: "add2",
        func: n => n + 2
    }, {
        name: "concat2",
        func: ( str1, str2 ) => str1 + " " + str2
    } ];

    beforeEach( "reset crossbar state", () => {
        server.setOptsDefault();
    } );

    it( "should getOpts correctly", () => {
        expect( server.getOpts() ).to.eql( DEFAULT_OPTS );
    } );

    it( "should setOpts correctly", () => {
        const modification = {
            publish: "I like bananas"
        };
        const expected = Object.assign( {}, DEFAULT_OPTS, modification );
        server.setOpts( modification );
        expect( server.getOpts() ).to.eql( expected );
    } );

    it( "should reset options to default", () => {
        server.setOptsDefault();
        expect( server.getOpts() ).to.eql( DEFAULT_OPTS );
    } );

    it( "should connect to crossbar", done => {
        server.connect()
            .then( () => {
                expect( server.getConnection().isConnected ).to.be.true;
            } )
            .then( () => done() )
            .catch( err => done( err ) );
    } );

    it( "should have an open connection after connecting", () => {
        expect( server.getConnection().isOpen ).to.be.true;
    } );

    it( "should have a session from the connection", () => {
        expect( server.getSession() ).to.not.equal( undefined );
    } );

    it( "should be able to register RPCs", done => {
        server.register( rpcList )
            .then( done )
            .catch( done );
    } );

    it( "should be able to register one single rpc correctly", done => {
        server.register( "singleRPC", () => {} )
            .then( () => done() )
            .catch( err => done( err ) );
    } );

    it( "should throw if one of the passed RPCs to register has an invalid name", () => {
        const wrongRPCList = [ {
            name: {},
            func: () => {}
        } ];

        expect( server.register( wrongRPCList ) ).to.be.rejectedWith( Error );
    } );

    it( "should throw if one of the passed RPCs to register has an invalid function", () => {
        const wrongRPCList = [ {
            name: "failRPC",
            func: "Not a function!"
        } ];

        expect( server.register( wrongRPCList ) ).to.be.rejectedWith( Error );
    } );

    it( "should be able to call an RPC with the correct parameters", () => {
        const rpcName = "hello";
        const callSpy = sinon.spy( server.getSession(), "call" );

        server.call( rpcName );
        expect( callSpy.calledWith( rpcName, [], {} ) ).to.be.true;
        callSpy.restore();
    } );

    it( "should be able to call a registered RPC with no args", done => {
        server.call( "hello" )
            .then( response => {
                expect( response ).to.eql( "Hello World" );
                done();
            } )
            .catch( err => done( err ) );
    } );

    it( "should be able to call a registered RPC with an argument", done => {
        server.call( "add2", 2 )
            .then( response => {
                expect( response ).to.eql( 4 );
                done();
            } )
            .catch( err => done( err ) );
    } );

    it( "should be able to call a registered RPC with multiple argument", done => {
        server.call( "concat2", "Hola", "Mundo" )
            .then( response => {
                expect( response ).to.eql( "Hola Mundo" );
                done();
            } )
            .catch( err => done( err ) );
    } );

    it( "should throw if registering an RPC fails", () => {
        expect( server.register( rpcList ) ).to.be.rejectedWith( Error );
    } );

    it( "should throw if register gets wrong parameters", () => {
        const wrongParam = 0;
        expect( server.register( wrongParam ) ).to.be.rejectedWith( Error );
    } );

    it( "should be able to unregister a registered RPC", done => {
        server.unregister( "hello" )
            .then( () => done() )
            .catch( err => done( err ) );
    } );

    it( "should be able to unregister multiple registered RPCs", done => {
        server.unregister( "concat2", "add2" )
            .then( () => done() )
            .catch( err => done( err ) );
    } );

    it( "should reject if trying to unregister an unknown RPC", () => {
        expect( server.unregister( "bananas" ) ).to.be.rejectedWith( Error );
    } );

    it( "should reject if unregister is called with wrong parameters", () => {
        expect( server.unregister( 0 ) ).to.be.rejectedWith( Error );
    } );

    it( "should reject if unregister gets an array with invalid arguments", () => {
        expect( server.unregister( 0, 1 ) ).to.be.rejectedWith( Error );
    } );

    it( "should reject when crossbar fails to unregister", done => {
        const unregisterStub = sinon.stub( server.getSession(), "unregister" );
        unregisterStub.rejects();

        const rpcName = "test",
            rpcFn = () => {};
        server.register( rpcName, rpcFn )
            .then( () => {
                expect( server.unregister( rpcName ) ).to.be.rejectedWith( Error );
                unregisterStub.restore();
                done();
            } );
    } );

    it( "should publish messages with one argument", () => {
        const message = "Hello World";
        const topic = "event";
        const pubSpy = sinon.spy( server.getSession(), "publish" );
        server.publish( topic, message );
        expect( pubSpy.calledWith( topic, [ message ], {}, {} ) ).to.be.true;
        pubSpy.restore();
    } );

    it( "should publish messages with several arguments", () => {
        const args = [ "Hello", "World" ];
        const topic = "event";
        const pubSpy = sinon.spy( server.getSession(), "publish" );

        server.publish( topic, ...args );
        expect( pubSpy.calledWith( topic, args, {}, {} ) ).to.be.true;
        pubSpy.restore();
    } );

    it( "should subscribe to topics", () => {
        const topic = "TestTopic";
        const callback = () => {};
        const subSpy = sinon.spy( server.getSession(), "subscribe" );

        server.subscribe( topic, callback );

        const spyArgs = subSpy.args[ 0 ];
        expect( spyArgs[ 0 ] ).to.eql( topic );
        expect( isFunction( spyArgs[ 1 ] ) ).to.be.true;
        expect( spyArgs[ 2 ] ).to.eql( {} );
        subSpy.restore();
    } );

    it( "should be able to pass correct parameters to subscribed functions", done => {
        server.setOpts( {
            publish: {
                exclude_me: false
            }
        } );

        const topic = "TestTopic2";
        const param1 = 1,
            param2 = 2;

        server.subscribe( topic, ( n1, n2 ) => {
            expect( n1 ).to.eql( param1 );
            expect( n2 ).to.eql( param2 );
            done();
        } );
        server.publish( topic, param1, param2 );
    } );

    it( "should reject if re-subscribing to a topic", () => {
        const topic = "TestTopic";
        expect( server.subscribe( topic ) ).to.be.rejectedWith( Error );
    } );

    it( "should reject when crossbar fails to subscribe", () => {
        const subscribeStub = sinon.stub( server.getSession(), "subscribe" );
        subscribeStub.rejects();

        const topic = "test1";
        expect( server.subscribe( topic ) ).to.be.rejectedWith( Error );
        subscribeStub.restore();
    } );

    it( "should unsubscribe from topics", done => {
        const topic = "TestTopic2";
        server.unsubscribe( topic )
            .then( done )
            .catch( done );
    } );

    it( "should reject when unsubscribing from a topic we are not subscribed to", () => {
        const fakeTopic = "fakeTopic";
        expect( server.unsubscribe( fakeTopic ) ).to.be.rejectedWith( Error );
    } );

    it( "should reject when crossbar fails to unsubscribe", done => {
        const topic = "TestTopic1";
        const callback = () => {};

        server.subscribe( topic, callback )
            .then( () => {
                const unsubscribeStub = sinon.stub( server.getSession(), "unsubscribe" );
                unsubscribeStub.rejects();

                expect( server.unsubscribe( topic ) ).to.be.rejectedWith( Error );
                unsubscribeStub.restore();
                done();
            } )
            .catch( err => done( err ) );
    } );

    it( "should disconnect from crossbar", done => {
        server.disconnect()
            .then( () => {
                expect( server.getConnection().isConnected ).to.be.false;
            } )
            .then( done )
            .catch( err => done( err ) );
    } );

    it( "should reject if disconnect fails", () => {
        expect( server.disconnect() ).to.be.rejected;
    } );
} );
