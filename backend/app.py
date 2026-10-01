import os
from flask import Flask, jsonify

from db import init_db

from routes import auth_routes, students, payments, holidays, notifications, dashboard, reports, profile, audit_routes


def create_app():
    app = Flask(__name__)
    app.url_map.strict_slashes = False

    # Never leak raw exceptions/tracebacks to clients
    app.config["PROPAGATE_EXCEPTIONS"] = False

    init_db()

    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(students.bp)
    app.register_blueprint(payments.bp)
    app.register_blueprint(holidays.bp)
    app.register_blueprint(notifications.bp)
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(reports.bp)
    app.register_blueprint(profile.bp)
    app.register_blueprint(audit_routes.bp)

    @app.after_request
    def set_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store"
        # CORS: restrict to the configured frontend origin only
        origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    @app.route("/<path:_any>", methods=["OPTIONS"])
    @app.route("/", methods=["OPTIONS"], defaults={"_any": ""})
    def cors_preflight(_any):
        return "", 204

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(e):
        # Log internally in production; never expose stack traces/DB errors
        app.logger.exception("Unhandled error")
        return jsonify({"error": "Internal server error"}), 500

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    return app


app = create_app()

if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    port = int(os.environ.get("PORT", "5001"))  # 5001 avoids macOS AirPlay on 5000
    app.run(host="127.0.0.1", port=port, debug=debug_mode)
