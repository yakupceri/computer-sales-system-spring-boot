package com.yakup.sales.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;

/** Swagger UI'da görünen API başlığı ve açıklaması. */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI computerSalesOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Computer Sales System API")
                .version("v1")
                .description("Bilgisayar satış sistemi REST API'si: dinamik filtreleme, kategori/ürün CRUD ve sipariş oluşturma.")
                .contact(new Contact().name("Yakup Çeri").url("https://github.com/yakupceri"))
                .license(new License().name("MIT").url("https://opensource.org/licenses/MIT")));
    }
}
