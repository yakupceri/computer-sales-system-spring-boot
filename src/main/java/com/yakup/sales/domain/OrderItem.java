package com.yakup.sales.domain;

import java.math.BigDecimal;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "order_items")

public class OrderItem {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

     private Integer quantity;
    private BigDecimal price;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    @JsonIgnore // Order -> items -> order döngüsünü kırar
    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;


}
