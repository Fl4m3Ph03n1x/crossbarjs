"use strict";

const isString = require( "lodash.isstring" );
const isFunction = require( "lodash.isfunction" );
const autobahn = require( "autobahn" );

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

    const connect = function ( connectOpts = Object.assign( {}, DEFAULT_OPTS.connect ) ) {
        return new Promise( resolve => {
            connection = new autobahn.Connection( connectOpts );
            connection.onopen = () => resolve();
            connection.open();
        } );
    };

    const disconnect = function () {
        return new Promise( resolve => {
            connection.onclose = () => resolve();
            connection.close();
        } );
    };

    const getSession = function () {
        return connection.session;
    };
    const getConnection = function () {
        return connection;
    };

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
                reject( new TypeError(`${name} must be a String.`) );
                return;
            }

            if ( !isFunction( func ) ) {
                reject( new TypeError(`${func} must be a Function.`) );
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
                reject( new TypeError(`${name} must be a String.`) );
                return;
            }

            if ( !registrationMap.has( name ) ) {
                reject( new Error(`${name} is not registered.`) );
                return;
            }

            getSession().unregister( name )
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

    const call = function ( rpcName, ...args ) {
        return getSession().call( rpcName, args, options.call );
    };

    const getOpts = function () {
        return Object.assign( {}, options );
    };

    const setOpts = function ( newOpts ) {
        options = newOpts;
    };

    const setOptsDefault = function () {
        setOpts( DEFAULT_OPTS );
    };

    const publish = function ( topic, ...message ) {
        return getSession().publish( topic, message, {}, options.publish );
    };

    const subscribe = function ( topic, callback ) {
        return new Promise( ( resolve, reject ) => {

            if ( subscritionMap.has( topic ) ) {
                reject( new Error(`Already subscribed to ${topic}`) );
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

    const unsubscribe = function ( topic ) {
        return new Promise( ( resolve, reject ) => {
            if ( !subscritionMap.has( topic ) ) {
                reject( new Error (`Not subscribed to ${topic}`) );
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
