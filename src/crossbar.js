"use strict";

const isString = require( "lodash.isstring" );
const isFunction = require( "lodash.isfunction" );
const autobahn = require( "autobahn" );

/**
 *  @typedef  RPC
 *  @type     {Object}
 *  @property {string}    name  The name of the RPC.
 *  @property {function}  func  The function to execute.
 */

/**
 *  @typedef  options
 *  @type     {Object}
 *  @property {Object}  connect             See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#connection-options|connection options}
 *  @property {string}  [connect.url="ws://localhost:8080/ws"]  Crossbar "url" to connect to.
 *  @property {string}  [connect.realm="realm1"]                Crossbar "realm" for the "url".
 *  @property {Object}  [publish={}]        See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#publish|publish options}
 *  @property {Object}  [subscribe={}]      See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#subscribe|subscribe options}
 *  @property {Object}  [call={}]           See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#call|call options}
 *  @property {Object}  [register={}]       See {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#register|register options}
 *
 */

/**
 *  @public
 *  @author   Pedro Miguel P. S. Martins
 *  @version  1.0.1
 *  @module   crossbarFacade
 *  @desc     Encapsulates crossbar publish/subscribe and
 *            register/unregister/call functionality into a facade, easier to
 *            use and reason about.
 */
const crossbarFacade = () => {

    const DEFAULT_OPTS = Object.freeze( {
        connect: {
            "url": "ws://localhost:8080/ws",
            "realm": "realm1"
        },
        publish: {},
        subscribe: {},
        call: {},
        register: {}
    } );

    const subscritionMap = new Map(),
        registrationMap = new Map();

    let connection,
        options = Object.assign( {}, DEFAULT_OPTS );

    /**
     *  @public
     *  @function connect
     *  @param    {Object=}  [connectOpts]  Connection object with the
     *                                      options to connect.
     *                                      The provided Object must have both
     *                                      an <code>url</code> and a
     *                                      <code>realm</code> properties to
     *                                      properly connect or else it fails.
     *                                      If no  object is passed, the
     *                                      function will use the default object.
     *  @param    {string}  [connectOpts.url = "ws://localhost:8080/ws"]  The connection 'url' as described in autobahn connection options.
     *  @param    {string}  [connectOpts.realm = "realm1"]                The connection 'realm' as described in autobahn connection options.
     *  @returns  {Promise}
     *
     *  @description  Connects this instance to the given direction. Will only
     *                resolve once a connection is successfully open.
     *
     *  @see          {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#connection-options|autobahn-js connection options}
     *
     *  @example  <caption>Creates a connection with the default parameters:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  crossbar.connect()
     *    .then(() => console.log("Great Success!"))
     *    .catch(console.log);
     *
     *  @example  <caption>Creates a connections with custom parameters:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  const connectParams = {url: "myURL", realm: "Lovecraft"};
     *  crossbar.connect(connectParams)
     *    .then(() => console.log("Great Success!"))
     *    .catch(console.log);
     *
     *  @example  <caption>Additionally, you may also change the "options.connect":</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *
     *  crossbar.setOpts({
     *    connect: { url: "myURL", realm: "Lovecraft" }
     *  });
     *
     *  crossbar.connect()
     *    .then(() => console.log("Great Success!"))
     *    .catch(console.log);
     */
    const connect = function ( connectOpts = options.connect ) {
        return new Promise( resolve => {
            connection = new autobahn.Connection( connectOpts );
            connection.onopen = () => resolve();
            connection.open();
        } );
    };

    /**
     *  @public
     *  @function disconnect
     *  @returns {Promise}
     *
     *  @description  Closes the crossbar connection. Resolves once the
     *                connection is closed.
     *
     *  @example <caption>Simply disconnect:</caption>
     *
     *  //imagine we have previously connected
     *  crossbar.disconnect()
     *    .then(() => console.log("disconnected!"))
     *    .catch(console.log);
     *
     *  @example <caption>Disconnect after connecting:</caption>
     *  const crossbarjs = require("crossbarjs");
     *
     *  const crossbar  = crossbarjs();
     *  crossbar.connect()
     *    .then(() => console.log("connected!"))
     *    .then(crossbar.disconnect)
     *    .then(() => console.log("disconnected!"))
     *    .catch(console.log);
     */
    const disconnect = function () {
        return new Promise( resolve => {
            connection.onclose = () => resolve();
            connection.close();
        } );
    };

    /**
     *  @public
     *  @function getSession
     *  @returns {Session}
     *
     *  @description  Returns the current autobahn.Session object. Ideally you
     *                shouldn't need to use it with the current interface, but
     *                in case you need you can have direct access to it.
     *
     *  @see {@link https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#sessions|autobahn-js sessions}
     *
     *  @example <caption>Using a session:</caption>
     *  //Assuming we have previously connected
     *  const session = crossbar.getSession();
     *  console.log(`Session id is: ${session.id}`);
     */
    const getSession = function () {
        return connection.session;
    };

    /**
     *  @public
     *  @function getConnection
     *  @returns {Connection}
     *
     *  @description  Returns the current autobahn.Connection object.
     *
     *  @see  {@link  https://github.com/crossbario/autobahn-js/blob/master/doc/reference.md#connections|autobahn-js connections}
     *
     *  @example <caption>Using a connection:</caption>
     *  //Assuming we have previously connected
     *  const conn = crossbar.getConnection();
     */
    const getConnection = function () {
        return connection;
    };

    /**
     *  @public
     *  @function register
     *  @param    {(string|RPC[])}  args  It can either receive two arguments,
     *                                    a string and a function, to register
     *                                    one RPC, or it can receive an array of
     *                                    RPC objects, to register them all.
     *  @returns  {Promise}
     *
     *  @description  Registers the given RPCs, biinding each RPC to a name. It
     *                can either register a single RPC, or an array of RPC
     *                objects. Resolves if all RPCs were registered successfully
     *                or rejects if one of them fails.
     *
     *  @example <caption>Registering a single RPC:</caption>
     *  //Assuming we have previously connected
     *  const myHello = () => {
     *      console.log("Hello World");
     *  }
     *
     *  crossbar.register("hello", myHello)
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     *
     *  @example <caption>Registering a multiple RPCs:</caption>
     *  //Assuming we have previously connected
     *  const myHello = () => {
     *      console.log("Hello World");
     *  }
     *
     *  const myGoodbye = () => {
     *      console.log("Goodbye World!");
     *  };
     *
     *  const RPCs = [
     *      { name: "hello" , func: myHello   },
     *      { name: "bye"   , func: myGoodbye }
     *  ];
     *
     *  crossbar.register(RPCs)
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     */
    const register = function ( ...args ) {
        const argsArray = Array.from( args );

        if ( Array.isArray( argsArray[ 0 ] ) )
            return registerMany( argsArray[ 0 ] );

        if ( isString( argsArray[ 0 ] ) && isFunction( argsArray[ 1 ] ) && argsArray.length === 2 )
            return registerOne( argsArray[ 0 ], argsArray[ 1 ] );

        return Promise.reject( new Error( "Unrecognized parameters" ) );
    };

    const registerOne = function ( name, func ) {
        return new Promise( ( resolve, reject ) => {
            if ( !isString( name ) ) {
                reject( new TypeError( `${name} must be a String.` ) );
                return;
            }

            if ( !isFunction( func ) ) {
                reject( new TypeError( `${func} must be a Function.` ) );
                return;
            }

            getSession().register( name, deCrossbarify( func ), options.register )
                .then( registration => {
                    registrationMap.set( name, registration );
                    resolve();
                } )
                .catch( err => reject( err ) );
        } );
    };

    const registerMany = async function ( rpcList ) {
        for ( const rpc of rpcList ) {
            await registerOne( rpc.name, rpc.func )
                .catch( err => {
                    throw new Error( `Failed to register "${rpc.name}":
                      ${JSON.stringify(err)}` );
                } );
        }
    };


    /**
     *  @public
     *  @function unregister
     *  @param  {(string|string[])} args  The name of a single RPC to unregister
     *                                    or an array of RPC names to unregister.
     *  @returns {Promise}
     *
     *  @description  Unregisters the RPC with the given name, or all the RPCs
     *                with the names provided in the array. Returns a promise
     *                once all RPCs have be unregistered successfully or rejects
     *                if one of them fails.
     *
     *  @example <caption>Unregister a single RPC:</caption>
     *  //Assuming we have previously connected and registered "hello"
     *  crossbar.unregister("hello")
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     *
     *  @example <caption>Unregister multiple RPCs:</caption>
     *  //Assuming we have previously connected and registered the RPCs with the given names
     *  crossbar.unregister(["hello", "bye"])
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     */
    const unregister = function ( args ) {
        if ( Array.isArray( args ) )
            return unregisterMany( args );

        if ( isString( args ) && arguments.length === 1 )
            return unregisterOne( args );

        return Promise.reject( new Error( "Unrecognized parameters" ) );
    };

    const unregisterOne = function ( name ) {
        return new Promise( ( resolve, reject ) => {
            if ( !isString( name ) ) {
                reject( new TypeError( `${name} must be a String.` ) );
                return;
            }

            if ( !registrationMap.has( name ) ) {
                reject( new Error( `${name} is not registered.` ) );
                return;
            }

            getSession().unregister( registrationMap.get( name ) )
                .then( () => {
                    registrationMap.delete( name );
                    resolve();
                } )
                .catch( err => reject( err ) );
        } );
    };

    const unregisterMany = async function ( rpcNamesList ) {
        for ( const rpcName of rpcNamesList ) {
            await unregisterOne( rpcName )
                .catch( err => {
                    throw new Error( `Failed to unregister "${rpcName.name}":
                      ${JSON.stringify(err)}` );
                } );
        }
    };

    /**
     *  @public
     *  @function call
     *  @param    {string}    rpcName The name of the RPC we wish to call.
     *  @param    {...Object} args    Variable number of arguments we wish to
     *                                pass.
     *  @returns  {Promise}
     *
     *  @description  Calls the RPC with the given name, providing the given
     *                arguments. Resolves if it succeeds, rejects otherwise.
     *
     *  @example <caption>Call an RPC with no arguments:</caption>
     *  //Assuming we have previously connected and registered the RPC "hello"
     *
     *  const hello = () => {
     *      console.log("Hello World");
     *  };
     *
     *  crossbar.call("hello")
     *      .then(() => console.log("great success!"))
     *      .catch(console.log);
     *
     *  @example <caption>Call an RPC with multiple arguments:</caption>
     *  //Assuming we have previously connected and registered the RPC "add"
     *
     *  const add = (n1, n2) => n1 + n2;
     *
     *  crossbar.call("add", 1, 2)
     *      .then(sum => console.log(`sum is: ${sum}`))
     *      .catch(console.log);
     */
    const call = function ( rpcName, ...args ) {
        return getSession().call( rpcName, args, options.call );
    };

    /**
     *  @public
     *  @function getOpts
     *  @returns  {options}
     *
     *  @description  Returns a clone of the options object.
     *
     *  @example <caption>Get a clone of the options object:</caption>
     *  let opts = crossbar.getOpts();
     *  opts = {};  //this wont alter the object being used in crossbarjs
     */
    const getOpts = function () {
        return Object.assign( {}, options );
    };

    /**
     *  @public
     *  @function setOpts
     *  @param    {Object}  newOpts The options we want to add.
     *
     *  @description  Concatenates the given options object with the current
     *                one. This is the only way to change the <code>options</code>
     *                object.
     *
     *  @see {options}
     *
     *  @example <caption>Add publish parameters to the options object:</caption>
     *  crossbar.setOpts({
     *      publish: { some options }
     *  });
     *  console.log(JSON.stringify(crossbar.getOpts()));
     *  //will print
     *  //{
     *  //  connect: {
     *  //    "url": "ws://localhost:8080/ws",
     *  //    "realm": "realm1"
     *  //  },
     *  //  publish: { some options },
     *  //  subscribe: {},
     *  //  call: {},
     *  //  register: {}
     *  //}
     */
    const setOpts = function ( newOpts ) {
        Object.assign( options, newOpts );
    };


    /**
     *  @public
     *  @function setOptsDefault
     *
     *  @description  Resets the options object to its default state.
     *
     *  @see  {options}
     */
    const setOptsDefault = function () {
        options = Object.assign( {}, DEFAULT_OPTS );
    };

    /**
     *  @public
     *  @function publish
     *  @param    {string}    topic   description
     *  @param    {...Object} message description
     *  @returns  {Promise}           description
     *
     *  @description  description
     */
    const publish = function ( topic, ...message ) {
        return getSession().publish( topic, message, {}, options.publish );
    };


    /**
     *  @public
     *  @function subscribe
     *  @param    {string}    topic     description
     *  @param    {function}  callback  description
     *  @returns  {Promise}             description
     *
     *  @description  description
     */
    const subscribe = function ( topic, callback ) {
        return new Promise( ( resolve, reject ) => {

            if ( subscritionMap.has( topic ) ) {
                reject( new Error( `Already subscribed to ${topic}` ) );
                return;
            }

            getSession()
                .subscribe( topic, deCrossbarify( callback ), options.subscribe )
                .then( subscription => {
                    subscritionMap.set( topic, subscription );
                    resolve();
                } )
                .catch( err => reject( err ) );
        } );
    };

    const deCrossbarify = callback => args => callback.call( null, ...args );

    /**
     *  @public
     *  @function unsubscribe
     *  @param    {string}  topic description
     *  @returns  {Promise}       description
     *
     *  @description  description
     */
    const unsubscribe = function ( topic ) {
        return new Promise( ( resolve, reject ) => {
            if ( !subscritionMap.has( topic ) ) {
                reject( new Error( `Not subscribed to ${topic}` ) );
                return;
            }

            getSession().unsubscribe( subscritionMap.get( topic ) )
                .then( () => {
                    subscritionMap.delete( topic );
                    resolve();
                } )
                .catch( err => reject( err ) );
        } );
    };

    return Object.freeze( {
        connect,
        disconnect,
        getSession,
        getConnection,
        register,
        unregister,
        call,
        setOpts,
        getOpts,
        setOptsDefault,
        publish,
        subscribe,
        unsubscribe
    } );
};

module.exports = crossbarFacade;
