import {noLambdaHandler} from "./etc";

/**
 * @api {GET} /entities
 * @apiPermission myService1:MyAction1
 * @apiPermission myService2:MyAction2
 */
exports.handler = () => {
    noLambdaHandler()
};
