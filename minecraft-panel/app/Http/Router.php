<?php

declare(strict_types=1);

namespace Btp\Http;

/**
 * Tiny path router with `{param}` placeholders. Optional `?r=` fallback keeps
 * the panel usable on hosts where URL rewriting is disabled.
 */
final class Router
{
    /** @var list<array{method:string,regex:string,params:list<string>,handler:callable}> */
    private array $routes = [];

    public function get(string $pattern, callable $handler): void
    {
        $this->add('GET', $pattern, $handler);
    }

    public function post(string $pattern, callable $handler): void
    {
        $this->add('POST', $pattern, $handler);
    }

    public function put(string $pattern, callable $handler): void
    {
        $this->add('PUT', $pattern, $handler);
    }

    public function patch(string $pattern, callable $handler): void
    {
        $this->add('PATCH', $pattern, $handler);
    }

    public function delete(string $pattern, callable $handler): void
    {
        $this->add('DELETE', $pattern, $handler);
    }

    private function add(string $method, string $pattern, callable $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/', static function (array $m) use (&$params): string {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method' => $method,
            'regex' => '#^' . $regex . '$#',
            'params' => $params,
            'handler' => $handler,
        ];
    }

    /**
     * @return array{handler:callable,params:array<string,string>}|null
     */
    public function match(string $method, string $path): ?array
    {
        $method = strtoupper($method);
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }
            if (preg_match($route['regex'], $path, $matches) === 1) {
                array_shift($matches);
                $params = [];
                foreach ($route['params'] as $index => $name) {
                    $params[$name] = rawurldecode($matches[$index] ?? '');
                }
                return ['handler' => $route['handler'], 'params' => $params];
            }
        }
        return null;
    }

    /**
     * True when a path exists for any method (used to answer 405 instead of 404).
     */
    public function hasPath(string $path): bool
    {
        foreach ($this->routes as $route) {
            if (preg_match($route['regex'], $path) === 1) {
                return true;
            }
        }
        return false;
    }
}
