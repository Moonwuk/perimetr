package ru.moongametechnology.perimeter;

import java.net.URI;

/** Remote access is only for the configured game API, never page or script loading. */
final class NetworkPolicy {
    private NetworkPolicy() {}

    static boolean allows(String origin, String requestUrl, String method, boolean mainFrame) {
        if (mainFrame || origin == null || origin.isEmpty()) return false;
        try {
            URI server = URI.create(origin);
            URI request = URI.create(requestUrl);
            if (!"https".equals(server.getScheme()) || !"https".equals(request.getScheme())
                || server.getHost() == null || !server.getHost().equalsIgnoreCase(request.getHost())
                || server.getRawUserInfo() != null || request.getRawUserInfo() != null
                || (server.getPort() != -1 && server.getPort() != 443)
                || (request.getPort() != -1 && request.getPort() != 443)
                || !server.getRawPath().isEmpty() || server.getRawQuery() != null || server.getRawFragment() != null
                || request.getRawFragment() != null) return false;
            String path = request.getRawPath();
            if ("/api/rooms".equals(path)) return "GET".equals(method) || "POST".equals(method) || "OPTIONS".equals(method);
            if ("/api/metrics".equals(path)) return "POST".equals(method) || "OPTIONS".equals(method);
            if ("/api/health".equals(path)) return "GET".equals(method) || "OPTIONS".equals(method);
            return false;
        } catch (IllegalArgumentException error) {
            return false;
        }
    }
}
