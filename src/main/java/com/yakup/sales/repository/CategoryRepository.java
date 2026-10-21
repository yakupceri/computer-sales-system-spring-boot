package com.yakup.sales.repository;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import com.yakup.sales.domain.Category;

@Repository
public interface CategoryRepository extends JpaRepository<Category , Long> , JpaSpecificationExecutor<com.yakup.sales.domain.Category> {

    // Metot adından sorgu üretilir: SELECT COUNT(*) > 0 FROM categories WHERE LOWER(name) = LOWER(?)
    boolean existsByNameIgnoreCase(String name);

    // Güncellemede kategorinin kendisi hariç aynı isim var mı?
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
