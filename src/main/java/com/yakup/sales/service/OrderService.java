package com.yakup.sales.service;

import com.yakup.sales.domain.Customer;
import com.yakup.sales.domain.Order;
import com.yakup.sales.domain.OrderItem;
import com.yakup.sales.domain.Product;
import com.yakup.sales.domain.StockMovement;
import com.yakup.sales.dto.CreateOrderRequest;
import com.yakup.sales.repository.CustomerRepository;
import com.yakup.sales.repository.OrderRepository;
import com.yakup.sales.repository.ProductRepository;
import com.yakup.sales.repository.StockMovementRepository;
import com.yakup.sales.specification.FiltersSpecification;
import com.yakup.sales.specification.IBaseFilterService;

import lombok.RequiredArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class OrderService implements IBaseFilterService<Order, OrderRepository> {

    private final OrderRepository repo;
    private final FiltersSpecification<Order> filters;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final StockMovementRepository stockMovementRepository;

    @Override public OrderRepository getRepository() { return repo; }
    @Override public FiltersSpecification<Order> getFiltersSpecification() { return filters; }

    public Order findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sipariş bulunamadı: " + id));
    }

    /**
     * Siparişi tek bir transaction içinde oluşturur:
     * stok kontrolü → stok düşme → stok hareketi (OUT) → sipariş kalemleri → toplam tutar.
     * Herhangi bir adımda hata olursa (ör. yetersiz stok) hiçbir değişiklik kaydedilmez.
     */
    @Transactional
    public Order create(CreateOrderRequest request) {
        Customer customer = customerRepository.findById(request.customerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Müşteri bulunamadı: " + request.customerId()));

        // Aynı ürün iki kez gönderildiyse adetleri birleştir
        Map<Long, Integer> quantities = new LinkedHashMap<>();
        for (CreateOrderRequest.Item item : request.items()) {
            quantities.merge(item.productId(), item.quantity(), Integer::sum);
        }

        Instant now = Instant.now();
        Order order = new Order();
        order.setCustomer(customer);
        order.setOrderDate(now);
        List<OrderItem> items = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (Map.Entry<Long, Integer> entry : quantities.entrySet()) {
            Product product = productRepository.findByIdForUpdate(entry.getKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Ürün bulunamadı: " + entry.getKey()));
            int quantity = entry.getValue();
            int stock = product.getStockQuantity() == null ? 0 : product.getStockQuantity();
            if (stock < quantity) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Yetersiz stok: " + product.getName() + " (stokta " + stock + ", istenen " + quantity + ")");
            }
            product.setStockQuantity(stock - quantity);

            OrderItem item = new OrderItem();
            item.setOrder(order);
            item.setProduct(product);
            item.setQuantity(quantity);
            item.setPrice(product.getPrice()); // satış anındaki fiyat saklanır
            items.add(item);
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(quantity)));

            StockMovement movement = new StockMovement();
            movement.setProduct(product);
            movement.setQuantityChange(-quantity);
            movement.setMovementDate(now);
            movement.setType("OUT");
            stockMovementRepository.save(movement);
        }

        order.setItems(items);
        order.setTotalPrice(total);
        return repo.save(order); // kalemler cascade ile birlikte kaydedilir
    }
}
