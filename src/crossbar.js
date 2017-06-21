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
        if ( !isString( name ) )
            throw new TypeError( `${name} must be a String.` );

        if ( !isFunction( func ) )
            throw new TypeError( `${func} must be a Function.` );

        return getSession().register( name, func, options.register );
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
        return getSession().subscribe( topic, callback, options.subscribe );
    };

    return Object.freeze( {
        connect,
        disconnect,
        getSession,
        getConnection,
        register,
        call,
        setOpts,
        getOpts,
        setOptsDefault,
        publish,
        subscribe
    } );
};

module.exports = crossbarFacade;
