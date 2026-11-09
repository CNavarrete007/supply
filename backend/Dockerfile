# Local development image. The production server/runtime is a separate deployment.
FROM php:8.4.26-cli-bookworm@sha256:836ac6c672d1372a47c8fd61b625015bd07760f493fb2eaab2087636498a2b4b AS php-runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu-dev libonig-dev unzip \
    && docker-php-ext-install -j"$(nproc)" intl mbstring mysqli \
    && rm -rf /var/lib/apt/lists/*

COPY docker/php-dev.ini /usr/local/etc/php/conf.d/zz-supplyflow.ini
WORKDIR /var/www/html

FROM php-runtime AS dependencies
ADD --checksum=sha256:7a2d379d5b8ffdaa028580ef26494c36d2feef4b178d3dd1473a4dbc5e17c8d6 https://getcomposer.org/download/2.10.3/composer.phar /usr/local/bin/composer
COPY composer.json composer.lock ./
RUN php /usr/local/bin/composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-progress --no-autoloader
COPY app ./app
RUN php /usr/local/bin/composer dump-autoload --no-dev --optimize --no-scripts

FROM php-runtime AS development
COPY --from=dependencies /var/www/html/vendor ./vendor
COPY --chown=www-data:www-data . .
RUN mkdir -p writable/cache writable/logs writable/session writable/uploads \
    && chown -R www-data:www-data writable

ENV CI_ENVIRONMENT=development
USER www-data
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=4s --start-period=20s --retries=3 CMD ["php", "/var/www/html/bin/healthcheck.php"]
CMD ["php", "spark", "serve", "--host", "0.0.0.0", "--port", "8080"]
