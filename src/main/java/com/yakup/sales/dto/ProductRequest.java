package com.yakup.sales.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Ürün ekleme / güncelleme isteği.
 * Entity yerine DTO almak, istemcinin id gibi alanları göndermesini engeller
 * ve kategoriyi sadece id ile seçtirir.
 */
public record ProductRequest(
        @NotBlank(message = "Ürün adı boş olamaz")
        @Size(max = 150, message = "Ürün adı en fazla 150 karakter olabilir")
        String name,

        @NotBlank(message = "SKU boş olamaz")
        @Size(max = 50, message = "SKU en fazla 50 karakter olabilir")
        String sku,

        @NotNull(message = "Fiyat zorunludur")
        @DecimalMin(value = "0.0", message = "Fiyat negatif olamaz")
        @Digits(integer = 16, fraction = 2, message = "Fiyat en fazla 2 ondalık basamak içerebilir")
        BigDecimal price,

        @NotNull(message = "Stok miktarı zorunludur")
        @Min(value = 0, message = "Stok miktarı negatif olamaz")
        Integer stockQuantity,

        @NotNull(message = "Kategori zorunludur")
        Long categoryId) {
}
