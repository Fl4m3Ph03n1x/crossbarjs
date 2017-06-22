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
 *  @public
 *  @author   Pedro Miguel P. S. Martins
 *  @version  1.0.1
 *  @module   crossbarFacade
 *  @desc     Encapsulates crossbar publish/subscribe and
 *            register/unregister/call functionality into a facade, easier to
 *            use and reason about.
 */
const crossbarFacade = () => {

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

    const subscritionMap = new Map(),
        registrationMap = new Map();

    let connection,
        options = DEFAULT_OPTS;

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
     */
    const connect = function ( connectOpts = Object.assign( {}, DEFAULT_OPTS.connect ) ) {
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
     *  @description     Promise
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
     *  @returns {type}  description
     *
     *  @description  description
     */
    const getSession = function () {
        return connection.session;
    };


    /**
     *  @public
     *  @function getConnection
     *  @returns {type}  description
     *
     *  @description description
     */
    const getConnection = function () {
        return connection;
    };


    /**
     *  @public
     *  @function register
     *  @param    {(string|RPC[])} args description
     *  @returns  {type}         description
     *
     *  @description  description
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
     *  @param  {(string|string[])} args  description
     *  @returns {Promise}      description
     *
     *  @description  description
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
     *  @param    {string}    rpcName description
     *  @param    {...Object} args    description
     *  @returns  {Promise}           description
     *
     *  @description description
     */
    const call = function ( rpcName, ...args ) {
        return getSession().call( rpcName, args, options.call );
    };

    /**
     *  @public
     *  @function getOpts
     *  @returns {type}  description
     *
     *  @description  description
     */
    const getOpts = function () {
        return Object.assign( {}, options );
    };


    /**
     *  @public
     *  @function setOpts
     *  @param    {type}  newOpts description
     *  @returns  {type}          description
     *
     *  @description  description
     */
    const setOpts = function ( newOpts ) {
        options = newOpts;
    };


    /**
     *  @public
     *  @function setOptsDefault
     *  @returns  {type}  description
     *
     *  @description  description
     */
    const setOptsDefault = function () {
        setOpts( DEFAULT_OPTS );
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
