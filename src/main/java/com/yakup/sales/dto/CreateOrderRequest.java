package com.yakup.sales.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Sipariş oluşturma isteği. Fiyat istemciden alınmaz; sunucu ürünün güncel fiyatını kullanır.
 */
public record CreateOrderRequest(
        @NotNull(message = "Müşteri zorunludur")
        Long customerId,

        @NotEmpty(message = "Sipariş en az bir ürün içermelidir")
        @Size(max = 50, message = "Bir siparişte en fazla 50 kalem olabilir")
        List<@Valid Item> items) {

    public record Item(
            @NotNull(message = "Ürün zorunludur")
            Long productId,

            @NotNull(message = "Adet zorunludur")
            @Min(value = 1, message = "Adet en az 1 olmalıdır")
            @Max(value = 100, message = "Bir üründen en fazla 100 adet sipariş edilebilir")
            Integer quantity) {
    }
}
