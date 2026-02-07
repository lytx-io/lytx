//! Lytx CLI for calling the Lytx Site Data API.

const std = @import("std");

const DEFAULT_BASE_URL = "https://api.lytx.io";
const API_KEY_ENV = "LYTX_API_KEY";
const TABLE_ROW_LIMIT: usize = 100;

const CliError = error{
    InvalidArguments,
    MissingApiKey,
    UnknownCommand,
    InvalidMethod,
    UnknownEndpoint,
    InvalidOpenApi,
    MissingPathParam,
};

const Config = struct {
    base_url: []const u8 = DEFAULT_BASE_URL,
    api_key: ?[]const u8 = null,
    json_output: bool = false,
};

const ParsedCli = struct {
    config: Config,
    command: []const u8,
    command_args: []const [:0]u8,
};

const Param = struct {
    key: []const u8,
    value: []const u8,
    used: bool = false,
};

const TailArgs = struct {
    params: std.ArrayList(Param),
    body_json: ?[]const u8 = null,
    json_output: bool = false,

    fn deinit(self: *TailArgs, allocator: std.mem.Allocator) void {
        self.params.deinit(allocator);
    }
};

const RequestSpec = struct {
    method: std.http.Method,
    path: []const u8,
    auth_required: bool,
};

const HttpResponse = struct {
    status: std.http.Status,
    body: []u8,
};

const OpenApiOperation = struct {
    method: std.http.Method,
    path: []const u8,
    tag: []const u8,
    summary: []const u8,
    auth_required: bool,
};

pub fn main() void {
    run() catch |err| {
        var stderr_buf: [4096]u8 = undefined;
        var stderr_writer = std.fs.File.stderr().writer(&stderr_buf);
        defer stderr_writer.interface.flush() catch {};

        switch (err) {
            CliError.InvalidArguments => {
                stderr_writer.interface.print("error: invalid arguments\n\n", .{}) catch {};
                printUsage(&stderr_writer.interface) catch {};
            },
            CliError.MissingApiKey => {
                stderr_writer.interface.print(
                    "error: missing API key (use --api-key or {s})\n",
                    .{API_KEY_ENV},
                ) catch {};
            },
            CliError.UnknownCommand => {
                stderr_writer.interface.print("error: unknown command\n\n", .{}) catch {};
                printUsage(&stderr_writer.interface) catch {};
            },
            CliError.InvalidMethod => {
                stderr_writer.interface.print("error: invalid HTTP method\n", .{}) catch {};
            },
            CliError.UnknownEndpoint => {
                stderr_writer.interface.print("error: endpoint not found in OpenAPI spec\n", .{}) catch {};
            },
            CliError.InvalidOpenApi => {
                stderr_writer.interface.print("error: OpenAPI document is invalid\n", .{}) catch {};
            },
            CliError.MissingPathParam => {
                stderr_writer.interface.print("error: missing required path parameter\n", .{}) catch {};
            },
            else => {
                stderr_writer.interface.print("error: {t}\n", .{err}) catch {};
            },
        }

        std.process.exit(1);
    };
}

fn run() !void {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer {
        _ = gpa.deinit();
    }
    const allocator = gpa.allocator();

    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    const parsed_cli = try parseCliArgs(args);

    var owned_api_key: ?[]u8 = null;
    defer if (owned_api_key) |value| allocator.free(value);

    if (parsed_cli.config.api_key == null) {
        owned_api_key = std.process.getEnvVarOwned(allocator, API_KEY_ENV) catch |err| switch (err) {
            error.EnvironmentVariableNotFound => null,
            else => return err,
        };
    }

    const effective_api_key = parsed_cli.config.api_key orelse owned_api_key;

    var stdout_buf: [8192]u8 = undefined;
    var stdout_writer = std.fs.File.stdout().writer(&stdout_buf);
    defer stdout_writer.interface.flush() catch {};

    if (std.mem.eql(u8, parsed_cli.command, "help") or std.mem.eql(u8, parsed_cli.command, "--help") or std.mem.eql(u8, parsed_cli.command, "-h")) {
        try printUsage(&stdout_writer.interface);
        return;
    }

    if (std.mem.eql(u8, parsed_cli.command, "endpoints")) {
        const spec_response = try fetchOpenApi(allocator, parsed_cli.config.base_url);
        defer allocator.free(spec_response.body);
        if (@intFromEnum(spec_response.status) >= 300) {
            try printHttpError(&stdout_writer.interface, spec_response);
            return;
        }

        var parsed_spec = try parseJsonValue(allocator, spec_response.body);
        defer parsed_spec.deinit();

        try printOpenApiOperations(allocator, &stdout_writer.interface, parsed_spec.value);
        return;
    }

    if (std.mem.eql(u8, parsed_cli.command, "openapi")) {
        const spec_response = try fetchOpenApi(allocator, parsed_cli.config.base_url);
        defer allocator.free(spec_response.body);
        try renderResponse(
            allocator,
            &stdout_writer.interface,
            spec_response,
            true,
        );
        return;
    }

    if (std.mem.eql(u8, parsed_cli.command, "call")) {
        try runCallCommand(
            allocator,
            &stdout_writer.interface,
            parsed_cli.config,
            effective_api_key,
            parsed_cli.command_args,
        );
        return;
    }

    try runHybridCommand(
        allocator,
        &stdout_writer.interface,
        parsed_cli.config,
        effective_api_key,
        parsed_cli.command,
        parsed_cli.command_args,
    );
}

fn parseCliArgs(args: []const [:0]u8) !ParsedCli {
    var config: Config = .{};
    var index: usize = 1;

    while (index < args.len) : (index += 1) {
        const token = args[index];
        if (!std.mem.startsWith(u8, token, "--")) break;

        if (std.mem.eql(u8, token, "--base-url")) {
            index += 1;
            if (index >= args.len) return CliError.InvalidArguments;
            config.base_url = args[index];
            continue;
        }

        if (std.mem.eql(u8, token, "--api-key")) {
            index += 1;
            if (index >= args.len) return CliError.InvalidArguments;
            config.api_key = args[index];
            continue;
        }

        if (std.mem.eql(u8, token, "--json")) {
            config.json_output = true;
            continue;
        }

        break;
    }

    const command = if (index < args.len) args[index] else "help";
    const command_args = if (index + 1 < args.len) args[index + 1 ..] else &.{};
    return .{ .config = config, .command = command, .command_args = command_args };
}

fn runCallCommand(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    config: Config,
    effective_api_key: ?[]const u8,
    command_args: []const [:0]u8,
) !void {
    if (command_args.len < 2) return CliError.InvalidArguments;

    const method = try parseMethod(command_args[0]);
    const path = command_args[1];

    var tail = try parseTailArgs(allocator, command_args[2..]);
    defer tail.deinit(allocator);

    const openapi_response = try fetchOpenApi(allocator, config.base_url);
    defer allocator.free(openapi_response.body);
    if (@intFromEnum(openapi_response.status) >= 300) {
        try printHttpError(writer, openapi_response);
        return;
    }

    var spec_json = try parseJsonValue(allocator, openapi_response.body);
    defer spec_json.deinit();

    if (!operationExists(spec_json.value, method, path)) {
        return CliError.UnknownEndpoint;
    }

    const request_spec: RequestSpec = .{
        .method = method,
        .path = path,
        .auth_required = operationRequiresAuth(spec_json.value, method, path),
    };

    const response = try executeRequest(
        allocator,
        config.base_url,
        effective_api_key,
        request_spec,
        tail.params.items,
        tail.body_json,
    );
    defer allocator.free(response.body);

    try renderResponse(
        allocator,
        writer,
        response,
        config.json_output or tail.json_output,
    );
}

fn runHybridCommand(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    config: Config,
    effective_api_key: ?[]const u8,
    command: []const u8,
    command_args: []const [:0]u8,
) !void {
    var adjusted_args = command_args;
    var request_spec: RequestSpec = .{ .method = .GET, .path = "", .auth_required = true };

    if (std.mem.eql(u8, command, "health")) {
        request_spec = .{ .method = .GET, .path = "/health", .auth_required = false };
    } else if (std.mem.eql(u8, command, "sites")) {
        if (adjusted_args.len > 0 and std.mem.eql(u8, adjusted_args[0], "list")) {
            adjusted_args = adjusted_args[1..];
        }
        request_spec = .{ .method = .GET, .path = "/do/sites", .auth_required = true };
    } else if (std.mem.eql(u8, command, "read")) {
        request_spec = .{ .method = .GET, .path = "/do/read", .auth_required = true };
    } else if (std.mem.eql(u8, command, "schema")) {
        request_spec = .{ .method = .GET, .path = "/do/schema", .auth_required = true };
    } else if (std.mem.eql(u8, command, "events")) {
        request_spec = .{ .method = .GET, .path = "/do/events", .auth_required = true };
    } else if (std.mem.eql(u8, command, "stats")) {
        request_spec = .{ .method = .GET, .path = "/do/stats", .auth_required = true };
    } else if (std.mem.eql(u8, command, "event-summary") or std.mem.eql(u8, command, "summary")) {
        request_spec = .{ .method = .GET, .path = "/do/event-summary", .auth_required = true };
    } else if (std.mem.eql(u8, command, "time-series") or std.mem.eql(u8, command, "timeseries")) {
        request_spec = .{ .method = .GET, .path = "/do/time-series", .auth_required = true };
    } else if (std.mem.eql(u8, command, "metrics")) {
        request_spec = .{ .method = .GET, .path = "/do/metrics", .auth_required = true };
    } else if (std.mem.eql(u8, command, "query")) {
        request_spec = .{ .method = .POST, .path = "/do/query", .auth_required = true };
    } else {
        return CliError.UnknownCommand;
    }

    var tail = try parseTailArgs(allocator, adjusted_args);
    defer tail.deinit(allocator);

    var built_body: ?[]u8 = null;
    defer if (built_body) |body| allocator.free(body);

    var request_body = tail.body_json;
    if (request_spec.method == .POST and request_body == null and tail.params.items.len > 0) {
        built_body = try buildBodyFromParams(allocator, tail.params.items);
        request_body = built_body;
        for (tail.params.items) |*param| {
            param.used = true;
        }
    }

    const response = try executeRequest(
        allocator,
        config.base_url,
        effective_api_key,
        request_spec,
        tail.params.items,
        request_body,
    );
    defer allocator.free(response.body);

    try renderResponse(
        allocator,
        writer,
        response,
        config.json_output or tail.json_output,
    );
}

fn parseMethod(token: []const u8) !std.http.Method {
    if (std.ascii.eqlIgnoreCase(token, "GET")) return .GET;
    if (std.ascii.eqlIgnoreCase(token, "POST")) return .POST;
    if (std.ascii.eqlIgnoreCase(token, "PUT")) return .PUT;
    if (std.ascii.eqlIgnoreCase(token, "PATCH")) return .PATCH;
    if (std.ascii.eqlIgnoreCase(token, "DELETE")) return .DELETE;
    if (std.ascii.eqlIgnoreCase(token, "HEAD")) return .HEAD;
    if (std.ascii.eqlIgnoreCase(token, "OPTIONS")) return .OPTIONS;
    return CliError.InvalidMethod;
}

fn parseTailArgs(allocator: std.mem.Allocator, tokens: []const [:0]u8) !TailArgs {
    var params: std.ArrayList(Param) = .empty;
    errdefer params.deinit(allocator);

    var body_json: ?[]const u8 = null;
    var json_output = false;

    var index: usize = 0;
    while (index < tokens.len) : (index += 1) {
        const token = tokens[index];

        if (std.mem.eql(u8, token, "--body")) {
            index += 1;
            if (index >= tokens.len) return CliError.InvalidArguments;
            body_json = tokens[index];
            continue;
        }

        if (std.mem.eql(u8, token, "--json")) {
            json_output = true;
            continue;
        }

        const separator_index = std.mem.indexOfScalar(u8, token, '=') orelse return CliError.InvalidArguments;
        const key = token[0..separator_index];
        const value = token[separator_index + 1 ..];
        if (key.len == 0) return CliError.InvalidArguments;

        try params.append(allocator, .{ .key = key, .value = value, .used = false });
    }

    return .{
        .params = params,
        .body_json = body_json,
        .json_output = json_output,
    };
}

fn executeRequest(
    allocator: std.mem.Allocator,
    base_url: []const u8,
    effective_api_key: ?[]const u8,
    request_spec: RequestSpec,
    params: []Param,
    body: ?[]const u8,
) !HttpResponse {
    if (request_spec.auth_required and effective_api_key == null) {
        return CliError.MissingApiKey;
    }

    const resolved_path = try replacePathParams(allocator, request_spec.path, params);
    defer allocator.free(resolved_path);

    const request_url = try buildRequestUrl(allocator, base_url, resolved_path, params);
    defer allocator.free(request_url);

    var client: std.http.Client = .{ .allocator = allocator };
    defer client.deinit();

    var headers: std.ArrayList(std.http.Header) = .empty;
    defer headers.deinit(allocator);

    try headers.append(allocator, .{ .name = "accept", .value = "application/json" });

    if (request_spec.auth_required) {
        try headers.append(allocator, .{ .name = "x-api-key", .value = effective_api_key.? });
    }

    if (body != null) {
        try headers.append(allocator, .{ .name = "content-type", .value = "application/json" });
    }

    var response_writer: std.Io.Writer.Allocating = .init(allocator);
    errdefer response_writer.deinit();

    const fetch_result = try client.fetch(.{
        .location = .{ .url = request_url },
        .method = request_spec.method,
        .payload = body,
        .response_writer = &response_writer.writer,
        .extra_headers = headers.items,
    });

    const response_body = try response_writer.toOwnedSlice();
    return .{
        .status = fetch_result.status,
        .body = response_body,
    };
}

fn fetchOpenApi(allocator: std.mem.Allocator, base_url: []const u8) !HttpResponse {
    const request_spec: RequestSpec = .{
        .method = .GET,
        .path = "/openapi.json",
        .auth_required = false,
    };

    return executeRequest(allocator, base_url, null, request_spec, &.{}, null);
}

fn replacePathParams(allocator: std.mem.Allocator, raw_path: []const u8, params: []Param) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);

    var index: usize = 0;
    while (index < raw_path.len) {
        if (raw_path[index] != '{') {
            try out.append(allocator, raw_path[index]);
            index += 1;
            continue;
        }

        const close_index = std.mem.indexOfScalarPos(u8, raw_path, index + 1, '}') orelse return CliError.InvalidArguments;
        const param_name = raw_path[index + 1 .. close_index];
        const value = findAndUseParam(params, param_name) orelse return CliError.MissingPathParam;

        try appendUrlEncoded(&out, allocator, value);
        index = close_index + 1;
    }

    return out.toOwnedSlice(allocator);
}

fn findAndUseParam(params: []Param, key: []const u8) ?[]const u8 {
    for (params) |*param| {
        if (std.mem.eql(u8, param.key, key)) {
            param.used = true;
            return param.value;
        }
    }
    return null;
}

fn buildRequestUrl(
    allocator: std.mem.Allocator,
    base_url: []const u8,
    path: []const u8,
    params: []const Param,
) ![]u8 {
    var out: std.ArrayList(u8) = .empty;
    errdefer out.deinit(allocator);

    const base_ends_with_slash = base_url.len > 0 and base_url[base_url.len - 1] == '/';
    const path_starts_with_slash = path.len > 0 and path[0] == '/';

    try out.appendSlice(allocator, base_url);
    if (base_ends_with_slash and path_starts_with_slash) {
        try out.appendSlice(allocator, path[1..]);
    } else if (!base_ends_with_slash and !path_starts_with_slash) {
        try out.append(allocator, '/');
        try out.appendSlice(allocator, path);
    } else {
        try out.appendSlice(allocator, path);
    }

    var first_query = true;
    for (params) |param| {
        if (param.used) continue;

        if (first_query) {
            try out.append(allocator, '?');
            first_query = false;
        } else {
            try out.append(allocator, '&');
        }

        try appendUrlEncoded(&out, allocator, param.key);
        try out.append(allocator, '=');
        try appendUrlEncoded(&out, allocator, param.value);
    }

    return out.toOwnedSlice(allocator);
}

fn appendUrlEncoded(out: *std.ArrayList(u8), allocator: std.mem.Allocator, input: []const u8) !void {
    for (input) |byte| {
        if (isUrlUnreserved(byte)) {
            try out.append(allocator, byte);
            continue;
        }

        const high = hexUpper((byte >> 4) & 0x0f);
        const low = hexUpper(byte & 0x0f);
        try out.append(allocator, '%');
        try out.append(allocator, high);
        try out.append(allocator, low);
    }
}

fn isUrlUnreserved(byte: u8) bool {
    return std.ascii.isAlphanumeric(byte) or
        byte == '-' or
        byte == '_' or
        byte == '.' or
        byte == '~';
}

fn hexUpper(n: u8) u8 {
    return if (n < 10) ('0' + n) else ('A' + (n - 10));
}

fn operationExists(spec: std.json.Value, method: std.http.Method, path: []const u8) bool {
    const operation = getOperationValue(spec, method, path) orelse return false;
    _ = operation;
    return true;
}

fn operationRequiresAuth(spec: std.json.Value, method: std.http.Method, path: []const u8) bool {
    const operation = getOperationValue(spec, method, path) orelse return true;

    if (getObjectField(operation, "security")) |operation_security| {
        return securityFieldRequiresAuth(operation_security);
    }
    return false;
}

fn securityFieldRequiresAuth(value: std.json.Value) bool {
    return switch (value) {
        .array => |array| array.items.len > 0,
        else => false,
    };
}

fn getOperationValue(spec: std.json.Value, method: std.http.Method, path: []const u8) ?std.json.Value {
    const paths_value = getObjectField(spec, "paths") orelse return null;
    const path_item = getObjectField(paths_value, path) orelse return null;
    const method_key = methodKeyLower(method);
    return getObjectField(path_item, method_key);
}

fn getObjectField(value: std.json.Value, key: []const u8) ?std.json.Value {
    return switch (value) {
        .object => |object| object.get(key),
        else => null,
    };
}

fn methodKeyLower(method: std.http.Method) []const u8 {
    return switch (method) {
        .GET => "get",
        .POST => "post",
        .PUT => "put",
        .PATCH => "patch",
        .DELETE => "delete",
        .HEAD => "head",
        .OPTIONS => "options",
        .TRACE => "trace",
        .CONNECT => "connect",
    };
}

fn methodLabel(method: std.http.Method) []const u8 {
    return switch (method) {
        .GET => "GET",
        .POST => "POST",
        .PUT => "PUT",
        .PATCH => "PATCH",
        .DELETE => "DELETE",
        .HEAD => "HEAD",
        .OPTIONS => "OPTIONS",
        .TRACE => "TRACE",
        .CONNECT => "CONNECT",
    };
}

fn parseOpenApiMethod(method_name: []const u8) ?std.http.Method {
    if (std.mem.eql(u8, method_name, "get")) return .GET;
    if (std.mem.eql(u8, method_name, "post")) return .POST;
    if (std.mem.eql(u8, method_name, "put")) return .PUT;
    if (std.mem.eql(u8, method_name, "patch")) return .PATCH;
    if (std.mem.eql(u8, method_name, "delete")) return .DELETE;
    if (std.mem.eql(u8, method_name, "head")) return .HEAD;
    if (std.mem.eql(u8, method_name, "options")) return .OPTIONS;
    if (std.mem.eql(u8, method_name, "trace")) return .TRACE;
    if (std.mem.eql(u8, method_name, "connect")) return .CONNECT;
    return null;
}

fn printOpenApiOperations(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    spec: std.json.Value,
) !void {
    var operations: std.ArrayList(OpenApiOperation) = .empty;
    defer operations.deinit(allocator);

    const paths_value = getObjectField(spec, "paths") orelse return CliError.InvalidOpenApi;
    switch (paths_value) {
        .object => |paths_object| {
            var paths_iter = paths_object.iterator();
            while (paths_iter.next()) |path_entry| {
                const path = path_entry.key_ptr.*;
                const path_item = path_entry.value_ptr.*;

                if (path_item != .object) continue;

                var methods_iter = path_item.object.iterator();
                while (methods_iter.next()) |method_entry| {
                    const method = parseOpenApiMethod(method_entry.key_ptr.*) orelse continue;
                    const operation_value = method_entry.value_ptr.*;
                    if (operation_value != .object) continue;

                    const summary = if (getObjectField(operation_value, "summary")) |summary_value|
                        switch (summary_value) {
                            .string => |text| text,
                            else => "",
                        }
                    else
                        "";

                    const tag = if (getObjectField(operation_value, "tags")) |tags_value|
                        switch (tags_value) {
                            .array => |array| if (array.items.len > 0 and array.items[0] == .string) array.items[0].string else "-",
                            else => "-",
                        }
                    else
                        "-";

                    const auth_required = if (getObjectField(operation_value, "security")) |operation_security|
                        securityFieldRequiresAuth(operation_security)
                    else
                        false;

                    try operations.append(allocator, .{
                        .method = method,
                        .path = path,
                        .tag = tag,
                        .summary = summary,
                        .auth_required = auth_required,
                    });
                }
            }
        },
        else => return CliError.InvalidOpenApi,
    }

    if (operations.items.len == 0) {
        try writer.writeAll("No operations found in OpenAPI spec.\n");
        return;
    }

    var method_width: usize = "METHOD".len;
    var path_width: usize = "PATH".len;
    var tag_width: usize = "TAG".len;
    var auth_width: usize = "AUTH".len;
    var summary_width: usize = "SUMMARY".len;

    for (operations.items) |operation| {
        method_width = @max(method_width, methodLabel(operation.method).len);
        path_width = @max(path_width, operation.path.len);
        tag_width = @max(tag_width, operation.tag.len);
        const auth_len: usize = if (operation.auth_required) 3 else 2;
        auth_width = @max(auth_width, auth_len);
        summary_width = @max(summary_width, @min(operation.summary.len, 60));
    }

    try writePadded(writer, "METHOD", method_width);
    try writer.writeAll(" | ");
    try writePadded(writer, "PATH", path_width);
    try writer.writeAll(" | ");
    try writePadded(writer, "TAG", tag_width);
    try writer.writeAll(" | ");
    try writePadded(writer, "AUTH", auth_width);
    try writer.writeAll(" | SUMMARY\n");
    try printDivider(writer, &.{ method_width, path_width, tag_width, auth_width, summary_width });

    for (operations.items) |operation| {
        const summary = truncateForDisplay(operation.summary, 60);
        try writePadded(writer, methodLabel(operation.method), method_width);
        try writer.writeAll(" | ");
        try writePadded(writer, operation.path, path_width);
        try writer.writeAll(" | ");
        try writePadded(writer, operation.tag, tag_width);
        try writer.writeAll(" | ");
        try writePadded(writer, if (operation.auth_required) "yes" else "no", auth_width);
        try writer.print(" | {s}\n", .{summary});
    }

    try writer.writeAll("\n");
    try writer.print("Use `lytx call METHOD PATH key=value ...` to invoke any endpoint.\n", .{});
}

fn truncateForDisplay(value: []const u8, max_len: usize) []const u8 {
    if (value.len <= max_len) return value;
    if (max_len <= 3) return value[0..max_len];
    return value[0 .. max_len - 3];
}

fn printDivider(writer: *std.Io.Writer, widths: []const usize) !void {
    for (widths, 0..) |width, index| {
        try writeRepeat(writer, '-', width);
        if (index + 1 < widths.len) {
            try writer.writeAll("-+-");
        }
    }
    try writer.writeByte('\n');
}

fn writeRepeat(writer: *std.Io.Writer, byte: u8, count: usize) !void {
    var index: usize = 0;
    while (index < count) : (index += 1) {
        try writer.writeByte(byte);
    }
}

fn writePadded(writer: *std.Io.Writer, value: []const u8, width: usize) !void {
    try writer.writeAll(value);
    if (value.len >= width) return;
    try writeRepeat(writer, ' ', width - value.len);
}

fn renderResponse(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    response: HttpResponse,
    json_output: bool,
) !void {
    try writer.print(
        "HTTP {d} {s}\n",
        .{ @intFromEnum(response.status), response.status.phrase() orelse "" },
    );

    if (response.body.len == 0) return;

    if (json_output) {
        var parsed = parseJsonValue(allocator, response.body) catch {
            try writer.print("{s}\n", .{response.body});
            return;
        };
        defer parsed.deinit();

        try writePrettyJson(writer, parsed.value);
        try writer.writeByte('\n');
        return;
    }

    var parsed = parseJsonValue(allocator, response.body) catch {
        try writer.print("{s}\n", .{response.body});
        return;
    };
    defer parsed.deinit();

    try renderJsonHuman(allocator, writer, parsed.value);
}

fn printHttpError(writer: *std.Io.Writer, response: HttpResponse) !void {
    try writer.print(
        "HTTP {d} {s}\n{s}\n",
        .{ @intFromEnum(response.status), response.status.phrase() orelse "", response.body },
    );
}

fn parseJsonValue(allocator: std.mem.Allocator, input: []const u8) !std.json.Parsed(std.json.Value) {
    return std.json.parseFromSlice(std.json.Value, allocator, input, .{});
}

fn writePrettyJson(writer: *std.Io.Writer, value: std.json.Value) !void {
    var stringify: std.json.Stringify = .{
        .writer = writer,
        .options = .{ .whitespace = .indent_2 },
    };
    try stringify.write(value);
}

fn renderJsonHuman(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    value: std.json.Value,
) !void {
    if (try renderTableIfPossible(allocator, writer, value)) {
        return;
    }

    if (value == .object) {
        var object_iter = value.object.iterator();
        var all_scalars = true;
        while (object_iter.next()) |entry| {
            if (!isScalar(entry.value_ptr.*)) {
                all_scalars = false;
                break;
            }
        }

        if (all_scalars) {
            var iter = value.object.iterator();
            while (iter.next()) |entry| {
                var cell_buffer: [256]u8 = undefined;
                const cell = formatValueCell(entry.value_ptr.*, &cell_buffer);
                try writer.print("{s}: {s}\n", .{ entry.key_ptr.*, cell });
            }
            return;
        }
    }

    try writePrettyJson(writer, value);
    try writer.writeByte('\n');
}

fn renderTableIfPossible(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    value: std.json.Value,
) !bool {
    if (value == .array and isObjectArray(value.array)) {
        try printObjectArrayTable(allocator, writer, value.array, null);
        return true;
    }

    if (value != .object) return false;

    var table_field: ?[]const u8 = null;
    var table_array: ?std.json.Array = null;

    var field_iter = value.object.iterator();
    while (field_iter.next()) |entry| {
        const field_value = entry.value_ptr.*;
        if (field_value == .array and isObjectArray(field_value.array)) {
            table_field = entry.key_ptr.*;
            table_array = field_value.array;
            break;
        }
    }

    if (table_array == null) return false;

    var metadata_iter = value.object.iterator();
    while (metadata_iter.next()) |entry| {
        if (std.mem.eql(u8, entry.key_ptr.*, table_field.?)) continue;
        if (!isScalar(entry.value_ptr.*)) continue;

        var cell_buffer: [256]u8 = undefined;
        const cell = formatValueCell(entry.value_ptr.*, &cell_buffer);
        try writer.print("{s}: {s}\n", .{ entry.key_ptr.*, cell });
    }

    try printObjectArrayTable(allocator, writer, table_array.?, table_field);
    return true;
}

fn isObjectArray(array: std.json.Array) bool {
    if (array.items.len == 0) return false;
    for (array.items) |item| {
        if (item != .object) return false;
    }
    return true;
}

fn isScalar(value: std.json.Value) bool {
    return switch (value) {
        .null, .bool, .integer, .float, .number_string, .string => true,
        else => false,
    };
}

fn printObjectArrayTable(
    allocator: std.mem.Allocator,
    writer: *std.Io.Writer,
    array: std.json.Array,
    title: ?[]const u8,
) !void {
    if (title) |table_title| {
        try writer.print("\n{s}\n", .{table_title});
    }

    if (array.items.len == 0) {
        try writer.writeAll("(no rows)\n");
        return;
    }

    const row_count = @min(array.items.len, TABLE_ROW_LIMIT);
    const rows = array.items[0..row_count];

    var columns: std.ArrayList([]const u8) = .empty;
    defer columns.deinit(allocator);

    var seen: std.StringHashMap(void) = std.StringHashMap(void).init(allocator);
    defer seen.deinit();

    for (rows) |row| {
        var row_iter = row.object.iterator();
        while (row_iter.next()) |entry| {
            const key = entry.key_ptr.*;
            if (seen.contains(key)) continue;
            try seen.put(key, {});
            try columns.append(allocator, key);
        }
    }

    if (columns.items.len == 0) {
        try writer.writeAll("(no columns)\n");
        return;
    }

    var widths: std.ArrayList(usize) = .empty;
    defer widths.deinit(allocator);
    try widths.resize(allocator, columns.items.len);

    for (columns.items, 0..) |column, index| {
        widths.items[index] = column.len;
    }

    for (rows) |row| {
        for (columns.items, 0..) |column, index| {
            const value = row.object.get(column);
            var cell_buffer: [256]u8 = undefined;
            const cell = if (value) |actual| formatValueCell(actual, &cell_buffer) else "";
            widths.items[index] = @max(widths.items[index], cell.len);
        }
    }

    try printStringRow(writer, columns.items, widths.items);
    try printDivider(writer, widths.items);

    for (rows) |row| {
        for (columns.items, 0..) |column, index| {
            const value = row.object.get(column);
            var cell_buffer: [256]u8 = undefined;
            const cell = if (value) |actual| formatValueCell(actual, &cell_buffer) else "";
            try writePadded(writer, cell, widths.items[index]);
            if (index + 1 < columns.items.len) {
                try writer.writeAll(" | ");
            }
        }
        try writer.writeByte('\n');
    }

    if (array.items.len > row_count) {
        try writer.print("... {d} more rows\n", .{array.items.len - row_count});
    }
}

fn printStringRow(
    writer: *std.Io.Writer,
    values: []const []const u8,
    widths: []const usize,
) !void {
    for (values, 0..) |value, index| {
        try writePadded(writer, value, widths[index]);
        if (index + 1 < values.len) {
            try writer.writeAll(" | ");
        }
    }
    try writer.writeByte('\n');
}

fn formatValueCell(value: std.json.Value, buffer: []u8) []const u8 {
    return switch (value) {
        .null => "null",
        .bool => |v| if (v) "true" else "false",
        .integer => |v| std.fmt.bufPrint(buffer, "{d}", .{v}) catch "?",
        .float => |v| std.fmt.bufPrint(buffer, "{d}", .{v}) catch "?",
        .number_string => |v| clipCell(v),
        .string => |v| clipCell(v),
        .array => "[...]",
        .object => "{...}",
    };
}

fn clipCell(value: []const u8) []const u8 {
    if (value.len <= 72) return value;
    return value[0..72];
}

fn buildBodyFromParams(allocator: std.mem.Allocator, params: []const Param) ![]u8 {
    var out: std.Io.Writer.Allocating = .init(allocator);
    errdefer out.deinit();

    try out.writer.writeByte('{');
    for (params, 0..) |param, index| {
        if (index > 0) {
            try out.writer.writeByte(',');
        }
        try writeJsonString(&out.writer, param.key);
        try out.writer.writeByte(':');
        try writeJsonValueLiteral(&out.writer, param.value);
    }
    try out.writer.writeByte('}');

    return out.toOwnedSlice();
}

fn writeJsonValueLiteral(writer: *std.Io.Writer, raw: []const u8) !void {
    if (std.mem.eql(u8, raw, "true") or std.mem.eql(u8, raw, "false") or std.mem.eql(u8, raw, "null")) {
        try writer.writeAll(raw);
        return;
    }

    if (looksLikeInt(raw)) {
        _ = std.fmt.parseInt(i64, raw, 10) catch {
            try writeJsonString(writer, raw);
            return;
        };
        try writer.writeAll(raw);
        return;
    }

    if (looksLikeFloat(raw)) {
        _ = std.fmt.parseFloat(f64, raw) catch {
            try writeJsonString(writer, raw);
            return;
        };
        try writer.writeAll(raw);
        return;
    }

    try writeJsonString(writer, raw);
}

fn looksLikeInt(raw: []const u8) bool {
    if (raw.len == 0) return false;
    var start: usize = 0;
    if (raw[0] == '-' or raw[0] == '+') {
        if (raw.len == 1) return false;
        start = 1;
    }

    var index = start;
    while (index < raw.len) : (index += 1) {
        if (!std.ascii.isDigit(raw[index])) return false;
    }
    return true;
}

fn looksLikeFloat(raw: []const u8) bool {
    if (raw.len == 0) return false;
    return std.mem.indexOfAny(u8, raw, ".eE") != null;
}

fn writeJsonString(writer: *std.Io.Writer, value: []const u8) !void {
    try writer.writeByte('"');
    for (value) |byte| {
        switch (byte) {
            '"' => try writer.writeAll("\\\""),
            '\\' => try writer.writeAll("\\\\"),
            '\n' => try writer.writeAll("\\n"),
            '\r' => try writer.writeAll("\\r"),
            '\t' => try writer.writeAll("\\t"),
            else => {
                if (byte < 0x20) {
                    try writer.print("\\u00{x:0>2}", .{byte});
                } else {
                    try writer.writeByte(byte);
                }
            },
        }
    }
    try writer.writeByte('"');
}

fn printUsage(writer: *std.Io.Writer) !void {
    try writer.writeAll(
        \\lytx - Lytx API CLI
        \\Usage:
        \\  lytx [--base-url URL] [--api-key KEY] [--json] <command> [args]
        \\
        \\OpenAPI Commands:
        \\  lytx endpoints
        \\  lytx openapi
        \\  lytx call METHOD PATH [key=value ...] [--body JSON] [--json]
        \\
        \\Hybrid Commands:
        \\  lytx health
        \\  lytx sites [list] [limit=10]
        \\  lytx read site_id=123
        \\  lytx schema site_id=123
        \\  lytx events site_id=123 startDate=2026-01-01 endDate=2026-01-31
        \\  lytx stats site_id=123 startDate=2026-01-01 endDate=2026-01-31
        \\  lytx event-summary site_id=123
        \\  lytx time-series site_id=123 granularity=day
        \\  lytx metrics site_id=123 metricType=events
        \\  lytx query site_id=123 query='SELECT * FROM site_events LIMIT 10'
        \\
        \\Auth:
        \\  --api-key KEY or environment variable LYTX_API_KEY
    );
    try writer.writeByte('\n');
}

test "url encoding keeps unreserved characters" {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(allocator);
    try appendUrlEncoded(&out, allocator, "abc-_.~123");
    try std.testing.expectEqualStrings("abc-_.~123", out.items);
}

test "url encoding escapes spaces" {
    var gpa: std.heap.GeneralPurposeAllocator(.{}) = .init;
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(allocator);
    try appendUrlEncoded(&out, allocator, "a b");
    try std.testing.expectEqualStrings("a%20b", out.items);
}
