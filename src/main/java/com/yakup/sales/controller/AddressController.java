package com.yakup.sales.controller;

import com.yakup.sales.domain.Address;
import com.yakup.sales.dto.RequestDto;
import com.yakup.sales.service.AddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController //Gelen istekleri karşılamak için kullanılan bir sınıf olduğunu belirtir.
@RequestMapping("/api/addresses") //Gelen HTTP isteklerinin "/api/addresses" yoluna yönlendirilmesini sağlar. Bu sayede, bu denetleyici sınıfı, "/api/addresses" yoluna yapılan istekleri işlemek için kullanılabilir.
@RequiredArgsConstructor //Lombok kütüphanesinin bir özelliği olan @RequiredArgsConstructor, sınıfın final alanları için bir yapıcı (constructor) oluşturur. Bu sayede, bu alanlar sınıfın örneği oluşturulurken zorunlu olarak sağlanmalıdır.
public class AddressController { //Bu sınıf, Address ile ilgili HTTP isteklerini işlemek için kullanılan bir denetleyici (controller) sınıfıdır.
    private final AddressService service; //AddressService sınıfının bir örneğini temsil eden final bir alan. Bu alan, sınıfın yapıcı (constructor) yöntemi tarafından başlatılır ve değiştirilemez.

    @PostMapping("/filter") //Gelen HTTP POST isteklerini "/filter" yoluna yönlendiren bir yöntem olduğunu belirtir. Bu yöntem, filtreleme işlemlerini gerçekleştirmek için kullanılır.
    public List<Address> filter(@RequestBody RequestDto request) { //HTTP isteğinin gövdesinden (body) gelen veriyi RequestDto türünde bir nesne olarak alır. Bu nesne, filtreleme kriterlerini içerir.
        return service.findByFilters(request);
    }

    @PostMapping("/filter-page") //Gelen HTTP POST isteklerini "/filter-page" yoluna yönlendiren bir yöntem olduğunu belirtir. Bu yöntem, sayfalama (pagination) ile filtreleme işlemlerini gerçekleştirmek için kullanılır.
    public Page<Address> filterPage(@RequestBody RequestDto request, Pageable pageable) { //HTTP isteğinin gövdesinden (body) gelen veriyi RequestDto türünde bir nesne olarak alır ve sayfalama bilgilerini temsil eden Pageable nesnesini parametre olarak alır. Bu nesne, sayfalama işlemlerini yönetir.
        var spec = service.getFiltersSpecification().getSearchSpecification(request); //Filtreleme kriterlerini temsil eden bir spesifikasyon (specification) nesnesi oluşturur. Bu nesne, filtreleme işlemlerini gerçekleştirmek için kullanılır.
        return service.getRepository().findAll(spec, pageable);
    }
}
